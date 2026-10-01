"""Evidence-preserving layout and section routing for CVs.

The structured parser must not assume that PDF text extraction order is the
same as the visual reading order.  This module keeps the geometry available
until sections have been identified, then supplies conservative section
streams to entity extractors.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable

from app.services.document_parser import DocumentBlock
from app.services.normalizer import normalize_text


HeadingMatcher = Callable[[str], tuple[str, str] | None]


@dataclass(frozen=True)
class SectionRouting:
    """Section evidence selected from one or more visually coherent flows."""

    sections: dict[str, list[str]]
    line_sections: dict[str, str | None]
    diagnostics: tuple[str, ...] = ()


class CvSectionRouter:
    """Route blocks by page/column before recognising section headings.

    A date rail is deliberately kept as one visual flow.  Splitting it into a
    separate sidebar would break the Company--Role--Date evidence that the
    experience resolver requires.  Other multi-column pages are read column by
    column so content from a sidebar cannot leak into a main-column summary.
    """

    _DATE_RANGE = re.compile(
        r"(?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{2}|(?:19|20)\d{2}|"
        r"(?:january|february|march|april|may|june|july|august|september|"
        r"october|november|december)\s+(?:19|20)\d{2}",
        re.IGNORECASE,
    )

    @classmethod
    def route(
        cls,
        fallback_lines: list[str],
        blocks: list[DocumentBlock] | None,
        heading_match: HeadingMatcher,
    ) -> SectionRouting:
        if not blocks:
            sections, line_sections = cls._collect(((fallback_lines, True),), heading_match)
            return SectionRouting(sections, line_sections)

        flows = cls._flows(blocks)
        sections, line_sections = cls._collect(flows, heading_match)
        fallback_sections, fallback_line_sections = cls._collect(((fallback_lines, True),), heading_match)
        if not sections:
            sections, line_sections = fallback_sections, fallback_line_sections
            return SectionRouting(sections, line_sections, ("SECTION_ROUTING_FALLBACK",))
        for section, values in fallback_sections.items():
            if not sections.get(section):
                sections[section] = values
                for line, source in fallback_line_sections.items():
                    if source == section:
                        line_sections[line] = source

        diagnostics = ("SECTION_ROUTING_GEOMETRY",)
        if len(flows) > 1:
            diagnostics += ("SECTION_ROUTING_MULTI_FLOW",)
        return SectionRouting(sections, line_sections, diagnostics)

    @classmethod
    def _flows(cls, blocks: list[DocumentBlock]) -> list[tuple[list[str], bool]]:
        pages: dict[int, list[DocumentBlock]] = {}
        for block in blocks:
            if block.text.strip():
                pages.setdefault(block.page, []).append(block)

        flows: list[tuple[list[str], bool]] = []
        for page_blocks in pages.values():
            ordered = sorted(page_blocks, key=lambda item: (item.bbox[1], item.bbox[0]))
            columns = {item.column for item in ordered if item.column}
            if len(columns) < 2 or cls._has_date_rail(ordered):
                flows.append(([item.text for item in ordered], True))
                continue

            for column in sorted(columns):
                column_lines = [item.text for item in ordered if item.column == column]
                if column_lines:
                    flows.append((column_lines, False))
        return flows

    @classmethod
    def _has_date_rail(cls, blocks: list[DocumentBlock]) -> bool:
        by_column: dict[int, list[DocumentBlock]] = {}
        for block in blocks:
            if block.column:
                by_column.setdefault(block.column, []).append(block)
        for column_blocks in by_column.values():
            if len(column_blocks) < 2:
                continue
            dated = sum(bool(cls._DATE_RANGE.search(item.text)) for item in column_blocks)
            average_length = sum(len(item.text.strip()) for item in column_blocks) / len(column_blocks)
            if dated >= 2 and average_length <= 26:
                return True
        date_blocks = [item for item in blocks if cls._DATE_RANGE.search(item.text)]
        return any(
            any(
                candidate.bbox[2] <= date_block.bbox[0]
                and abs((candidate.bbox[1] + candidate.bbox[3]) - (date_block.bbox[1] + date_block.bbox[3])) <= 18
                for candidate in blocks
                if candidate is not date_block
            )
            for date_block in date_blocks
        )
        return False

    @staticmethod
    def _collect(
        flows: tuple[tuple[list[str], bool], ...] | list[tuple[list[str], bool]],
        heading_match: HeadingMatcher,
    ) -> tuple[dict[str, list[str]], dict[str, str | None]]:
        sections: dict[str, list[str]] = {}
        line_sections: dict[str, str | None] = {}
        current: str | None = None
        for flow, can_continue in flows:
            if not can_continue:
                current = None
            for original in flow:
                line = original.strip(" \t•●*-|\u200b")
                if not line:
                    continue
                heading = heading_match(line)
                if (
                    heading
                    and current == "experience"
                    and heading[0] == "awards"
                    and normalize_text(line, lowercase=True) in {
                        "achievement", "achievements", "key achievements", "thành tựu đạt được",
                    }
                ):
                    heading = None
                if heading:
                    current, remainder = heading
                    sections.setdefault(current, [])
                    line_sections[line] = current
                    if remainder:
                        sections[current].append(remainder)
                        line_sections[remainder] = current
                    continue
                line_sections.setdefault(line, current)
                if current is None:
                    continue
                if not sections[current] or sections[current][-1] != line:
                    sections[current].append(line)
        return sections, line_sections
