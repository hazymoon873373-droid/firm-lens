"""Synthetic fixtures test software only; never used as financial evidence."""
import copy
import math
import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import finance


def row(year=2020, ticker="VNM", **changes):
    value = dict(ticker=ticker, fiscal_year=year, fiscal_end=f"{year}-12-31",
                 published_at=f"{year + 1}-03-20", standard="VAS", scope="consolidated",
                 unit="million_VND", period_months=12, revenue=100.0, net_profit=10.0, assets=200.0,
                 liabilities=80.0, operating_cash_flow=None, verified=True, audited=True,
                 source_url="https://issuer.example/report.pdf", source_pages="4-7",
                 source_version="original audited filing", publication_evidence_url="https://issuer.example/disclosure",
                 source_sha256="a" * 64)
    value.update(changes)
    return value


class TrustBoundaryTests(unittest.TestCase):
    def test_rejects_untrusted_scope_units_nonfinite_and_denominators(self):
        for changes in ({"standard": "IFRS"}, {"scope": "separate"}, {"unit": "VND"},
                        {"revenue": 0}, {"assets": -1}, {"net_profit": math.nan},
                        {"assets": True}, {"verified": False}, {"audited": False},
                        {"liabilities": -1}, {"ticker": "DGC"}, {"source_url": "javascript:alert(1)"},
                        {"published_at": "2020-01-01"}, {"source_sha256": ""}, {"period_months": 6},
                        {"published_at": "20210320"}, {"fiscal_end": "20201231"}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                finance.validate_row(row(**changes))

    def test_missing_cashflow_remains_missing_and_loss_is_allowed(self):
        features = finance.features(row(net_profit=-10))
        self.assertEqual(features[:3], [-0.1, 0.4, None])
        self.assertAlmostEqual(features[3], math.log(200))
        self.assertEqual(features[4], 1.0)

    def test_duplicates_revisions_and_nonconsecutive_pairs_do_not_train(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            finance.build_pairs([row(), row()])
        self.assertEqual(finance.build_pairs([row(2018), row(2020)])[0], [])
        pairs, excluded = finance.build_pairs([row(2020, published_at="2023-01-01"), row(2021)])
        self.assertEqual(pairs, [])
        self.assertTrue(excluded)

    def test_split_uses_target_year_and_excludes_labels_unavailable_at_origin(self):
        rows = [row(year) for year in range(2019, 2025)]
        pairs, _ = finance.build_pairs(rows)
        splits, _ = finance.split_pairs(pairs)
        self.assertEqual([p["target_year"] for p in splits["train"]], [2020, 2021])
        self.assertEqual([p["target_year"] for p in splits["validation"]], [2022])
        self.assertEqual([p["target_year"] for p in splits["test"]], [2023, 2024])
        leaking = copy.deepcopy(pairs)
        leaking[0]["label_available_at"] = "2025-01-01"
        safe, excluded = finance.split_pairs(leaking)
        self.assertEqual([p["target_year"] for p in safe["train"]], [2021])
        self.assertTrue(excluded)

    def test_empty_real_dataset_exports_inactive_without_invented_metrics(self):
        result = finance.run([])
        self.assertFalse(result["active"])
        self.assertIsNone(result["model"])
        self.assertEqual(result["counts"]["train"], 0)
        self.assertIsNone(result["evaluation"])

    def test_changed_fiscal_calendar_cannot_be_treated_as_consecutive_annual_pair(self):
        pairs, excluded = finance.build_pairs([row(2020, fiscal_end="2020-06-30"), row(2021)])
        self.assertEqual(pairs, [])
        self.assertTrue(excluded)

    def test_metrics_keep_undefined_precision_and_recall_null(self):
        result = finance.metrics([0.1, 0.2], [0.11, 0.19], [0.1, 0.2])
        self.assertAlmostEqual(result["mae"], 0.01)
        self.assertEqual(result["warning"], dict(tp=0, fp=0, fn=0, tn=2, precision=None, recall=None))


class TrainingTests(unittest.TestCase):
    def test_preprocessing_is_train_only_and_json_predictions_match_sklearn(self):
        train = [dict(x=[0.1, 0.4, None, 4.0, 1.0], y=0.11),
                 dict(x=[0.2, 0.5, 0.2, 5.0, 0.0], y=0.21),
                 dict(x=[0.3, 0.6, 0.4, 6.0, 0.0], y=0.31)]
        model, fitted = finance.fit_model(train)
        self.assertAlmostEqual(model["impute_medians"][2], 0.3)
        self.assertAlmostEqual(model["means"][0], 0.2)
        query = [0.9, 0.4, None, 9.0, 1.0]
        self.assertAlmostEqual(finance.predict(model, query), fitted.predict([[0.9, 0.4, math.nan, 9.0, 1.0]])[0])
        self.assertAlmostEqual(model["means"][0], 0.2)

    def test_full_synthetic_panel_is_only_eligible_for_review_and_not_publicly_active(self):
        rows = [row(year, ticker=ticker, net_profit=year - 2010)
                for ticker in finance.COHORT for year in range(2016, 2026)]
        result = finance.run(rows)
        self.assertEqual(result["counts"], {"train": 50, "validation": 10, "test": 30})
        self.assertFalse(result["active"])
        self.assertEqual(result["evaluation"]["test"]["ridge"]["n"], 30)
        self.assertTrue(result["model"])

    @unittest.skipUnless(shutil.which("node"), "Node required for browser coefficient contract check")
    def test_node_and_python_exported_coefficient_predictions_match(self):
        model, _ = finance.fit_model([dict(x=[.1, .4, None, 4, 1], y=.2),
                                     dict(x=[.2, .3, None, 5, 1], y=.3)])
        values = [.15, .35, None, 4.5, 1]
        code = "let s='';for await(const c of process.stdin)s+=c;const {m,x}=JSON.parse(s);console.log(m.intercept+x.reduce((v,n,i)=>v+m.coefficients[i]*((n??m.impute_medians[i])-m.means[i])/m.scales[i],0));"
        result = subprocess.run(["node", "--input-type=module", "-e", code],
                                input=json.dumps(dict(m=model, x=values)), text=True, capture_output=True, check=True)
        self.assertAlmostEqual(float(result.stdout), finance.predict(model, values), places=12)


if __name__ == "__main__":
    unittest.main()
