from app.services.cv_structure import CvSectionRouter
from app.services.document_parser import DocumentBlock
from app.services.structured_cv_parser import StructuredCvParser


def test_router_keeps_side_by_side_contact_from_consuming_education() -> None:
    parser = StructuredCvParser()
    blocks = [
        DocumentBlock("EDUCATION", page=1, bbox=(20, 100, 130, 112), column=1),
        DocumentBlock("CONTACT INFORMATION", page=1, bbox=(350, 100, 520, 112), column=2),
        DocumentBlock("Northwind University", page=1, bbox=(20, 130, 210, 142), column=1),
        DocumentBlock("Bachelor of Marketing", page=1, bbox=(20, 146, 220, 158), column=1),
        DocumentBlock("candidate@example.test", page=1, bbox=(350, 130, 540, 142), column=2),
    ]
    routing = CvSectionRouter.route([block.text for block in blocks], blocks, parser._heading_match)

    assert routing.sections["education"] == ["Northwind University", "Bachelor of Marketing"]
    assert routing.sections["contact"] == ["candidate@example.test"]


def test_router_keeps_date_rail_rows_together_across_pages() -> None:
    parser = StructuredCvParser()
    blocks = [
        DocumentBlock("WORK EXPERIENCE", page=1, bbox=(20, 20, 220, 32), column=1),
        DocumentBlock("Northwind Retail", page=1, bbox=(20, 60, 230, 72), column=1),
        DocumentBlock("Jun 2023 - May 2024", page=1, bbox=(360, 60, 530, 72), column=2),
        DocumentBlock("Marketing Planner", page=1, bbox=(20, 76, 220, 88), column=1),
        DocumentBlock("Harbor Health", page=2, bbox=(20, 30, 220, 42), column=1),
        DocumentBlock("Jun 2022 - May 2023", page=2, bbox=(360, 30, 530, 42), column=2),
        DocumentBlock("Marketing Specialist", page=2, bbox=(20, 46, 250, 58), column=1),
    ]
    result = parser.parse_with_diagnostics(
        "\n".join(block.text for block in blocks),
        blocks=blocks,
        layout="MULTI_COLUMN",
    )

    assert {(item.company, item.position) for item in result.candidate.work_experience} == {
        ("Northwind Retail", "Marketing Planner"),
        ("Harbor Health", "Marketing Specialist"),
    }
