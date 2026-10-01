# MF-03 requirement evidence (experimental)

Plain-language `OTHER` requirements now expose `criteria`, with exact `cvText`
offsets and quoted evidence. The original requirement text remains in the result.
Known capabilities use a bounded bilingual vocabulary. Unrecognized conjuncts
are retained as literal criteria; they must not disappear simply because another
part matched. Inferred criteria are always marked `requiresManualReview`.
Mixed AND/OR expressions retain an unresolved-grouping criterion for review.

`evidenceCoverage` is criterion coverage, not a calibrated probability of fit.
Backend-only performance evidence cannot satisfy client performance. Negation,
aspirations, and obvious third-party attribution are excluded conservatively.
These checks are heuristic and do not constitute universal entailment detection.

The existing embedding model retrieves up to three candidate spans for review,
in one batched call over unresolved requirements and at most 256 sampled spans.
`suggestedEvidence.verified` is always false. Retrieved similarity never changes
the deterministic verdict or its coverage. API/worker callers use the common
MatchingService. No extra model or external CV upload is required.

Parser changes preserve project descriptions and wrapped technology lists,
exclude skill-group headings, normalize known versioned skills, and report
missing project descriptions. Parse confidence is a heuristic capped below 1;
it is not a measured field accuracy or a production-readiness certification.

Verification: `python -m pytest -q --disable-warnings`. New anonymized cases in
`tests/test_requirement_evidence.py` cover IT, Sales, Marketing, Vietnamese,
negation, aspirations, third-party attribution, unknown conjuncts, source spans,
semantic retrieval, and API serialization. These are regression cases, not an
independent labeled holdout benchmark. Production quality gates still require
human-labeled unseen CV/JD pairs and measured false positives/false negatives.
