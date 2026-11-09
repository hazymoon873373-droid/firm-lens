"""Strict VAS pilot pipeline. Input is manually reconciled facts, never LLM output."""
import argparse
from datetime import date
import hashlib
import json
import math
from pathlib import Path
import re
import statistics
from urllib.parse import urlsplit

COHORT = ("VNM", "SAB", "MSN", "MCH", "QNS", "SBT", "LSS", "BBC", "KDC", "NAF")
FEATURES = ("net_margin", "liabilities_assets", "cfo_assets", "log_assets_million_vnd", "cfo_missing")
VERSION = "vas-ridge-v1"


def validate_row(row):
    """Require explicit original-source metadata; a verified flag is human attestation."""
    if row.get("ticker") not in COHORT:
        raise ValueError("outside fixed pilot cohort")
    if type(row.get("fiscal_year")) is not int or not 2016 <= row["fiscal_year"] <= 2025:
        raise ValueError("fiscal year outside 2016-2025")
    if type(row.get("period_months")) is not int or row["period_months"] != 12:
        raise ValueError("only full twelve-month annual periods are eligible")
    for key, expected in (("standard", "VAS"), ("scope", "consolidated"), ("unit", "million_VND"),
                          ("verified", True), ("audited", True)):
        if row.get(key) != expected or (expected is True and row.get(key) is not True):
            raise ValueError(f"invalid {key}")
    for key in ("source_url", "publication_evidence_url"):
        parsed = urlsplit(row.get(key, ""))
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError(f"invalid {key}")
    for key in ("source_pages", "source_version"):
        if not isinstance(row.get(key), str) or not row[key].strip():
            raise ValueError(f"missing {key}")
    if not re.fullmatch(r"[0-9a-f]{64}", row.get("source_sha256", "")):
        raise ValueError("missing source_sha256")
    end = date.fromisoformat(row["fiscal_end"])
    published = date.fromisoformat(row["published_at"])
    if end.isoformat() != row["fiscal_end"] or published.isoformat() != row["published_at"]:
        raise ValueError("dates must use canonical YYYY-MM-DD")
    if end.year != row["fiscal_year"] or published <= end or published > date.today():
        raise ValueError("invalid fiscal/publication dates")
    for key in ("revenue", "net_profit", "assets", "liabilities", "operating_cash_flow"):
        value = row.get(key)
        if key == "operating_cash_flow" and value is None:
            continue
        if type(value) not in (int, float) or not math.isfinite(value):
            raise ValueError(f"invalid numeric {key}")
    if row["revenue"] <= 0 or row["assets"] <= 0 or row["liabilities"] < 0:
        raise ValueError("revenue/assets must be positive; liabilities nonnegative")
    return row


def features(row):
    validate_row(row)
    cfo = row["operating_cash_flow"]
    values = [row["net_profit"] / row["revenue"], row["liabilities"] / row["assets"],
              None if cfo is None else cfo / row["assets"], math.log(row["assets"]), float(cfo is None)]
    if any(value is not None and not math.isfinite(value) for value in values):
        raise ValueError("nonfinite financial ratio")
    return values


def build_pairs(rows):
    by_key, excluded = {}, []
    for row in rows:
        validate_row(row)
        key = (row["ticker"], row["fiscal_year"])
        if key in by_key:
            raise ValueError(f"duplicate company-year (resolve revisions explicitly): {key}")
        by_key[key] = row
    pairs = []
    for key, current in sorted(by_key.items()):
        target = by_key.get((key[0], key[1] + 1))
        if target is None:
            excluded.append({"ticker": key[0], "feature_year": key[1], "reason": "missing next fiscal year"})
            continue
        distance = (date.fromisoformat(target["fiscal_end"]) - date.fromisoformat(current["fiscal_end"])).days
        if distance not in (365, 366):
            excluded.append({"ticker": key[0], "feature_year": key[1], "reason": "changed fiscal calendar"})
            continue
        # A later comparative column cannot masquerade as information known earlier.
        if current["published_at"] >= target["published_at"] or current["published_at"] > target["fiscal_end"]:
            excluded.append({"ticker": key[0], "feature_year": key[1], "reason": "feature unavailable before target year ended/label published"})
            continue
        pairs.append(dict(ticker=key[0], feature_year=key[1], target_year=key[1] + 1,
                          origin=current["published_at"], label_available_at=target["published_at"],
                          x=features(current), y=features(target)[0]))
    return pairs, excluded


def split_pairs(pairs):
    splits = {"train": [], "validation": [], "test": []}
    for pair in pairs:
        year = pair["target_year"]
        if 2017 <= year <= 2021:
            splits["train"].append(pair)
        elif year == 2022:
            splits["validation"].append(pair)
        elif 2023 <= year <= 2025:
            splits["test"].append(pair)
    origins = [p["origin"] for name in ("validation", "test") for p in splits[name]]
    cutoff = min(origins) if origins else None
    excluded = []
    if cutoff:
        safe = []
        for pair in splits["train"]:
            if pair["label_available_at"] <= cutoff:
                safe.append(pair)
            else:
                excluded.append({"ticker": pair["ticker"], "target_year": pair["target_year"],
                                 "reason": "training label unavailable at earliest holdout forecast origin"})
        splits["train"] = safe
    return splits, excluded


def fit_model(train):
    """One prespecified alpha; no tuning on validation or test."""
    import sklearn
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import Ridge
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    x = [[math.nan if v is None else v for v in p["x"]] for p in train]
    fitted = make_pipeline(SimpleImputer(strategy="median", keep_empty_features=True),
                           StandardScaler(), Ridge(alpha=1.0, solver="svd"))
    fitted.fit(x, [p["y"] for p in train])
    imputer, scaler, regressor = fitted.steps[0][1], fitted.steps[1][1], fitted.steps[2][1]
    transformed = imputer.transform(x)
    export = dict(version=VERSION, features=list(FEATURES), alpha=1.0, sklearn_version=sklearn.__version__,
                  impute_medians=imputer.statistics_.tolist(), means=scaler.mean_.tolist(), scales=scaler.scale_.tolist(),
                  coefficients=regressor.coef_.tolist(), intercept=float(regressor.intercept_),
                  domain_min=transformed.min(axis=0).tolist(), domain_max=transformed.max(axis=0).tolist())
    return export, fitted


def predict(model, values):
    if len(values) != len(FEATURES):
        raise ValueError("expected five ordered features")
    return model["intercept"] + sum(coef * ((median if value is None else value) - mean) / scale
        for value, median, mean, scale, coef in zip(values, model["impute_medians"], model["means"],
                                                   model["scales"], model["coefficients"]))


def metrics(actual, predicted, current):
    if not actual or len(actual) != len(predicted) or len(actual) != len(current):
        raise ValueError("metrics require nonempty equal lengths")
    errors = [abs(a - p) for a, p in zip(actual, predicted)]
    tp = fp = fn = tn = 0
    for a, p, c in zip(actual, predicted, current):
        observed, warned = a <= c - 0.03, p <= c - 0.03
        tp += observed and warned
        fp += not observed and warned
        fn += observed and not warned
        tn += not observed and not warned
    return dict(n=len(actual), mae=statistics.mean(errors), median_absolute_error=statistics.median(errors),
                warning=dict(tp=tp, fp=fp, fn=fn, tn=tn, precision=tp / (tp + fp) if tp + fp else None,
                             recall=tp / (tp + fn) if tp + fn else None))


def run(rows):
    pairs, exclusions = build_pairs(rows)
    splits, late_labels = split_pairs(pairs)
    counts = {name: len(values) for name, values in splits.items()}
    result = dict(version=VERSION, active=False, status="insufficient_verified_data", model=None,
                  observation_count=len(rows), company_count=len({r["ticker"] for r in rows}),
                  counts=counts, exclusions=exclusions + late_labels, evaluation=None,
                  required_minimum=dict(train=50, validation=5, test=20, test_companies=5),
                  reason="Need at least 50 train, 5 validation and 20 test pairs from at least 5 test companies after temporal checks.")
    if (counts["train"] < 50 or counts["validation"] < 5 or counts["test"] < 20
            or len({p["ticker"] for p in splits["test"]}) < 5):
        return result
    model, _ = fit_model(splits["train"])
    evaluation = {}
    for name in ("validation", "test"):
        group = splits[name]
        actual, current = [p["y"] for p in group], [p["x"][0] for p in group]
        evaluation[name] = dict(ridge=metrics(actual, [predict(model, p["x"]) for p in group], current),
                                persistence=metrics(actual, current, current),
                                company_count=len({p["ticker"] for p in group}))
    # Prespecified comparison gates review eligibility; test never selects parameters.
    beats_baseline = all(evaluation[name]["ridge"]["mae"] < evaluation[name]["persistence"]["mae"]
                         for name in ("validation", "test"))
    result.update(active=False, eligible_for_review=beats_baseline,
                  status="experimental_pending_review" if beats_baseline else "baseline_not_beaten",
                  model=model, evaluation=evaluation,
                  reason="Experimental sector pilot requires independent review before browser activation." if beats_baseline
                  else "Ridge did not beat persistence on both holdouts; public warnings disabled.",
                  model_available_at=max(p["label_available_at"] for p in splits["train"]),
                  cohort=list(COHORT), warning_threshold_margin_points=3)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path("research/vas-observations.json"))
    parser.add_argument("--output", type=Path, default=Path("research/model-status.json"))
    args = parser.parse_args()
    raw = args.data.read_bytes()
    result = run(json.loads(raw))
    result["dataset_sha256"] = hashlib.sha256(raw).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "active": result["active"], "counts": result["counts"]}))


if __name__ == "__main__":
    main()
