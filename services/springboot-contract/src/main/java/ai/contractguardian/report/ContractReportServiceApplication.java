package ai.contractguardian.report;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Contract Report Service - Spring Boot Microservice
 * CO4: Spring Boot, IoC, DI, REST, JPA, PostgreSQL, Security, Actuator, OpenAPI, Async
 * CO5: Report/Analytics microservice with meaningful responsibilities
 */
@SpringBootApplication
@EnableAsync
public class ContractReportServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(ContractReportServiceApplication.class, args);
    }
}
