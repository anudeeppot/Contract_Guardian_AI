from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Analysis, ClauseAnalysis, Contract, Payment


class ContractRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, contract: Contract) -> Contract:
        self.db.add(contract)
        await self.db.flush()
        return contract

    async def get_owned(self, contract_id: UUID, user_id: UUID) -> Contract | None:
        return await self.db.scalar(
            select(Contract).where(Contract.id == contract_id, Contract.user_id == user_id)
        )

    async def list_owned(self, user_id: UUID) -> list[Contract]:
        result = await self.db.scalars(
            select(Contract).where(Contract.user_id == user_id).order_by(desc(Contract.created_at))
        )
        return list(result)

    async def delete(self, contract: Contract) -> None:
        await self.db.delete(contract)


class AnalysisRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, analysis: Analysis, clauses: list[ClauseAnalysis]) -> Analysis:
        self.db.add(analysis)
        await self.db.flush()
        for clause in clauses:
            clause.analysis_id = analysis.id
            self.db.add(clause)
        await self.db.flush()
        return analysis

    async def latest_for_contract(self, contract_id: UUID, user_id: UUID) -> Analysis | None:
        return await self.db.scalar(
            select(Analysis)
            .options(selectinload(Analysis.clauses))
            .where(Analysis.contract_id == contract_id, Analysis.user_id == user_id)
            .order_by(desc(Analysis.created_at))
        )

    async def get_owned(self, analysis_id: UUID, user_id: UUID) -> Analysis | None:
        return await self.db.scalar(
            select(Analysis)
            .options(selectinload(Analysis.clauses))
            .where(Analysis.id == analysis_id, Analysis.user_id == user_id)
        )


class PaymentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, payment: Payment) -> Payment:
        self.db.add(payment)
        await self.db.flush()
        return payment

    async def get_by_payment_id(self, payment_id: str) -> Payment | None:
        return await self.db.scalar(select(Payment).where(Payment.payment_id == payment_id))
