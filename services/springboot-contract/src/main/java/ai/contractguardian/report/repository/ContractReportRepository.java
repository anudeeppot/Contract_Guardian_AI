package ai.contractguardian.report.repository;

import ai.contractguardian.report.entity.ContractReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * CO4: Spring Data JPA Repository (IoC/DI)
 * CO1: JPQL queries demonstrating SQL concepts in Java
 */
@Repository
public interface ContractReportRepository extends JpaRepository<ContractReport, UUID> {

    List<ContractReport> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<ContractReport> findByContractId(UUID contractId);

    // JPQL with aggregate functions (CO1 concepts in JPA)
    @Query("SELECT AVG(r.riskScore) FROM ContractReport r WHERE r.userId = :userId")
    Double findAverageRiskScoreByUser(UUID userId);

    @Query("SELECT COUNT(r) FROM ContractReport r WHERE r.userId = :userId AND r.riskLevel = :riskLevel")
    Long countByUserAndRiskLevel(UUID userId, String riskLevel);

    @Query("SELECT r FROM ContractReport r WHERE r.riskScore >= :minScore ORDER BY r.riskScore DESC")
    List<ContractReport> findHighRiskReports(Integer minScore);
}
