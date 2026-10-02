package ai.contractguardian.report.controller;

import ai.contractguardian.report.entity.ContractReport;
import ai.contractguardian.report.repository.ContractReportRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * CO4: Spring Boot REST Controller
 * Demonstrates: IoC, DI, REST, JPA, Validation, OpenAPI, Async tasks
 * CO5: Contract Report microservice endpoint
 */
@RestController
@RequestMapping("/api/reports")
@Tag(name = "Contract Reports", description = "CO4: Spring Boot Contract Report Service")
@CrossOrigin(origins = "*")
public class ContractReportController {

    @Autowired  // CO4: Dependency Injection
    private ContractReportRepository reportRepository;

    @GetMapping("/health")
    @Operation(summary = "Service health check")
    public Map<String, Object> health() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("service", "contract-report-service");
        status.put("version", "1.0.0");
        status.put("status", "healthy");
        status.put("framework", "Spring Boot 3.2");
        status.put("co", Arrays.asList("CO4 (Spring Boot)", "CO5 (Microservice)"));
        status.put("features", Arrays.asList("IoC", "DI", "REST", "JPA", "PostgreSQL",
                "Validation", "SpringSecurity", "Actuator", "OpenAPI", "AsyncTasks"));
        status.put("timestamp", new Date().toInstant().toString());
        return status;
    }

    @PostMapping
    @Operation(summary = "Create a contract report record")
    public ResponseEntity<ContractReport> createReport(@Valid @RequestBody ContractReport report) {
        ContractReport saved = reportRepository.save(report);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/user/{userId}")
    @Operation(summary = "Get all reports for a user")
    public ResponseEntity<List<ContractReport>> getUserReports(@PathVariable UUID userId) {
        return ResponseEntity.ok(reportRepository.findByUserIdOrderByCreatedAtDesc(userId));
    }

    @GetMapping("/contract/{contractId}")
    @Operation(summary = "Get reports for a specific contract")
    public ResponseEntity<List<ContractReport>> getContractReports(@PathVariable UUID contractId) {
        return ResponseEntity.ok(reportRepository.findByContractId(contractId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get report by ID")
    public ResponseEntity<ContractReport> getReport(@PathVariable UUID id) {
        return reportRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a report")
    public ResponseEntity<Void> deleteReport(@PathVariable UUID id) {
        if (!reportRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        reportRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats/user/{userId}")
    @Operation(summary = "Risk statistics for a user")
    public ResponseEntity<Map<String, Object>> getUserStats(@PathVariable UUID userId) {
        Double avgRisk = reportRepository.findAverageRiskScoreByUser(userId);
        Long criticalCount = reportRepository.countByUserAndRiskLevel(userId, "CRITICAL");
        Long highCount = reportRepository.countByUserAndRiskLevel(userId, "HIGH");
        Long mediumCount = reportRepository.countByUserAndRiskLevel(userId, "MEDIUM");
        Long lowCount = reportRepository.countByUserAndRiskLevel(userId, "LOW");

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("userId", userId);
        stats.put("avgRiskScore", avgRisk != null ? Math.round(avgRisk * 100.0) / 100.0 : 0);
        stats.put("criticalReports", criticalCount);
        stats.put("highReports", highCount);
        stats.put("mediumReports", mediumCount);
        stats.put("lowReports", lowCount);
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/high-risk")
    @Operation(summary = "Get all high-risk reports (score >= 70)")
    public ResponseEntity<List<ContractReport>> getHighRiskReports(
            @RequestParam(defaultValue = "70") Integer minScore) {
        return ResponseEntity.ok(reportRepository.findHighRiskReports(minScore));
    }

    /**
     * Async task demo (CO4: Spring @Async)
     * Generates a report asynchronously
     */
    @PostMapping("/async-generate/{id}")
    @Operation(summary = "Asynchronously generate a report (CO4: @Async)")
    public ResponseEntity<Map<String, String>> asyncGenerateReport(@PathVariable UUID id) {
        triggerAsyncGeneration(id);
        return ResponseEntity.accepted().body(Map.of(
                "message", "Report generation started asynchronously",
                "reportId", id.toString(),
                "status", "PROCESSING"
        ));
    }

    @Async  // CO4: Async task execution
    public CompletableFuture<Void> triggerAsyncGeneration(UUID reportId) {
        try {
            Thread.sleep(2000); // Simulate PDF generation
            // In a real implementation, this would generate a PDF and update storage_path
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return CompletableFuture.completedFuture(null);
    }

    @GetMapping("/ioc-demo")
    @Operation(summary = "Demonstrate IoC and DI concepts (CO4)")
    public Map<String, Object> iocDemo() {
        Map<String, Object> demo = new LinkedHashMap<>();
        demo.put("concept", "Inversion of Control (IoC) & Dependency Injection (DI)");
        demo.put("spring_ioc",
                "Spring container manages object lifecycle and dependencies");
        demo.put("this_controller",
                "ContractReportController receives ContractReportRepository via @Autowired - Spring injects it");
        demo.put("benefits", Arrays.asList(
                "Loose coupling between components",
                "Easier testing with mock injection",
                "Centralized configuration",
                "Automatic lifecycle management"
        ));
        demo.put("bean_types", Map.of(
                "@Component", "Generic Spring-managed bean",
                "@Service", "Business logic layer",
                "@Repository", "Data access layer",
                "@Controller", "HTTP request handler",
                "@RestController", "Controller + @ResponseBody"
        ));
        return demo;
    }
}
