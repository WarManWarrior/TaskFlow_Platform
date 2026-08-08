# Stage 1: Build the Spring Boot application
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
# Download dependencies to cache them (speeds up future builds)
RUN mvn dependency:go-offline
COPY src ./src
# Compile the JAR, skipping tests for now to speed up Phase 1 builds
RUN mvn clean package -DskipTests

# Stage 2: Run the application
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
# Copy only the compiled JAR file from the builder stage
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]