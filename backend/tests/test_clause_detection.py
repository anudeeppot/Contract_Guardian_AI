from app.services.clause_detection import ClauseDetectionService


def test_clause_detection_splits_numbered_sections():
    text = """
1. Payment
Customer shall pay all fees within 10 days.

2. Termination
Vendor may terminate this agreement without cause.

3. Confidentiality
The parties shall keep confidential information private.
"""
    clauses = ClauseDetectionService().split_clauses(text)
    assert len(clauses) >= 3
    assert clauses[0]["title"].lower().startswith("1. payment")
