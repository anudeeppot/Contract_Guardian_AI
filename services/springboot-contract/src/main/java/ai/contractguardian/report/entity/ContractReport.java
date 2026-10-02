package ai.contractguardian.report.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.UUID;

/**
 * CO4: JPA Entity with validation annotations
 * Represents a contract report record in PostgreSQL
 */
@Entity
@Table(name = "contract_reports", indexes = {
    @Index(name = "idx_reports_contract_id", columnList = "contractId"),
    @Index(name = "idx_reports_user_id", columnList = "userId"),
})
public class ContractReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private UUID contractId;

    @NotNull
    @Column(nullable = false)
    private UUID userId;

    @NotBlank
    @Size(max = 500)
    @Column(nullable = false, length = 500)
    private String contractFilename;

    @Min(0) @Max(100)
    @Column(nullable = false)
    private Integer riskScore;

    @NotBlank
    @Column(nullable = false, length = 20)
    private String riskLevel;

    @Column(columnDefinition = "TEXT")
    private String summary;

    @Column(nullable = false)
    private Integer clauseCount = 0;

    @Column(nullable = false)
    private Integer criticalCount = 0;

    @Column(nullable = false)
    private Integer highCount = 0;

    @Column(nullable = false)
    private Integer mediumCount = 0;

    @Column(nullable = false)
    private Integer lowCount = 0;

    @Column(nullable = false)
    private String reportType = "PDF";

    @Column
    private String storagePath;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getContractId() { return contractId; }
    public void setContractId(UUID contractId) { this.contractId = contractId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getContractFilename() { return contractFilename; }
    public void setContractFilename(String contractFilename) { this.contractFilename = contractFilename; }

    public Integer getRiskScore() { return riskScore; }
    public void setRiskScore(Integer riskScore) { this.riskScore = riskScore; }

    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public Integer getClauseCount() { return clauseCount; }
    public void setClauseCount(Integer clauseCount) { this.clauseCount = clauseCount; }

    public Integer getCriticalCount() { return criticalCount; }
    public void setCriticalCount(Integer criticalCount) { this.criticalCount = criticalCount; }

    public Integer getHighCount() { return highCount; }
    public void setHighCount(Integer highCount) { this.highCount = highCount; }

    public Integer getMediumCount() { return mediumCount; }
    public void setMediumCount(Integer mediumCount) { this.mediumCount = mediumCount; }

    public Integer getLowCount() { return lowCount; }
    public void setLowCount(Integer lowCount) { this.lowCount = lowCount; }

    public String getReportType() { return reportType; }
    public void setReportType(String reportType) { this.reportType = reportType; }

    public String getStoragePath() { return storagePath; }
    public void setStoragePath(String storagePath) { this.storagePath = storagePath; }

    public Instant getCreatedAt() { return createdAt; }
}
