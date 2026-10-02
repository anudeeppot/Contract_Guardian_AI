import re


class ClauseDetectionService:
    heading_pattern = re.compile(
        r"(?m)^(?:\s*(?:\d+(?:\.\d+)*|[A-Z])[\).\s-]+)?([A-Z][A-Za-z \-/,&]{3,80})$"
    )

    def split_clauses(self, text: str) -> list[dict]:
        chunks = self._split_by_headings(text)
        if len(chunks) < 3:
            chunks = self._split_by_paragraphs(text)
        return [
            {"title": self._infer_title(chunk, index), "text": chunk.strip(), "position": index}
            for index, chunk in enumerate(chunks, start=1)
            if len(chunk.split()) >= 8
        ]

    def _split_by_headings(self, text: str) -> list[str]:
        lines = text.splitlines()
        chunks: list[str] = []
        current: list[str] = []
        for line in lines:
            is_heading = bool(self.heading_pattern.match(line.strip()))
            if is_heading and current:
                chunks.append("\n".join(current))
                current = [line]
            else:
                current.append(line)
        if current:
            chunks.append("\n".join(current))
        return chunks

    def _split_by_paragraphs(self, text: str) -> list[str]:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
        if len(paragraphs) <= 1:
            paragraphs = re.split(r"(?<=[.;])\s+(?=[A-Z])", text)
        return paragraphs

    def _infer_title(self, chunk: str, index: int) -> str:
        first = chunk.strip().splitlines()[0][:120]
        if len(first.split()) <= 10:
            return first.strip(" .:-") or f"Clause {index}"
        return f"Clause {index}"
