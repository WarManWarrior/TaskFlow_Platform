# TaskFlow Platform

TaskFlow is a team task-management application deployed on a small Kubernetes cluster. The project combines a React frontend, a Spring Boot API, PostgreSQL, container builds, GitHub Actions, Argo CD, and operational monitoring with Prometheus and Grafana.

The application supports personal tasks and team workspaces. Users can create and update tasks, collaborate on team boards, comment on tasks, view activity, and exchange chat messages with optional image attachments. The deployment work focuses on repeatable image builds, Kubernetes service boundaries, HTTPS, persistent data, backups, and operational visibility.

**Application:** https://taskflowteams.duckdns.org/

The live deployment URL belongs to the current EC2 environment. The hostname resolves through DuckDNS, and HTTPS is terminated at the Kubernetes Ingress layer using a cert-manager-managed Let's Encrypt certificate.

## Architecture

### Application traffic

~~~mermaid
flowchart TD
    Browser[Browser] --> DNS[DuckDNS hostname]
    DNS --> SG[AWS security group: TCP 80 and 443]
    SG --> NGINX[Ingress NGINX controller - current public entry point]
    NGINX -->|/| FE[Frontend Service: ClusterIP]
    NGINX -->|/api| BE[Backend Service: ClusterIP]
    FE --> FEPod[React build served by NGINX]
    BE --> BEPod[Spring Boot API on port 8080]
    BEPod --> DBSvc[PostgreSQL Service: ClusterIP]
    DBSvc --> DBPod[PostgreSQL 15]
    DBPod --> PVC[Persistent volume on the EC2 node]
~~~

The browser uses one hostname for the frontend and API. The Ingress routes `/` to the frontend and `/api` to the backend. The frontend image contains a production React build served by NGINX. The backend and database are not intended to be accessed directly from the public internet; they use internal Kubernetes Services.

The current public route is verified at `https://taskflowteams.duckdns.org/`. HTTP requests to the hostname return a redirect to HTTPS, and a normal certificate-verifying `curl` request to HTTPS returned `HTTP/2 200`. The production Certificate resource was observed with `READY=True`.

### Build and delivery flow

~~~mermaid
flowchart TD
    Dev[Commit or pull request to main] --> Actions[GitHub Actions CI]
    Actions --> Build[Build frontend and backend images]
    Build --> DockerHub[Docker Hub]
    DockerHub --> Tags[Commit SHA tag and latest tag]
    Actions --> Manifests[Update image tags in k8s-manifests]
    Manifests --> Git[Commit GitOps change to GitHub]
    Git --> Argo[Argo CD watches the application repository]
    Argo --> K8s[K3s deployments and Services]
    K8s --> App[TaskFlow application]
~~~

For pull requests, the workflow builds images without pushing them. For pushes to `main`, it logs in to Docker Hub, pushes the images, updates the backend and frontend deployment tags to the short source commit SHA, and commits those manifest changes back to the repository. The workflow includes concurrency and stale-build checks to reduce the chance of an older run overwriting newer image tags.

## Technology choices

| Technology | Purpose in this project |
|---|---|
| React 19 | Builds the interactive task, profile, team, and chat interface. |
| Vite | Runs the frontend development server and creates the production static build. |
| Tailwind CSS and application CSS | Provide styling for the frontend interface. |
| Node.js 22 Alpine | Builds frontend assets in the first Docker stage. |
| NGINX Alpine | Serves compiled frontend files and provides an API proxy configuration in the frontend container. |
| Java 17 | Runtime for the backend application. |
| Spring Boot 4.1 | Starts the backend API and manages application configuration. |
| Spring WebMVC | Implements the REST endpoints used by the frontend. |
| Spring Data JPA and Hibernate | Map Java entities to PostgreSQL tables and perform persistence operations. |
| Spring Security | Handles authentication, authorization, password hashing, CSRF protection, and session handling. |
| Spring Session JDBC | Stores HTTP session data in PostgreSQL, outside an individual backend pod. |
| Spring Boot Actuator | Exposes health endpoints for operational checks. |
| Maven | Resolves backend dependencies and builds the application JAR. |
| PostgreSQL 15 | Stores accounts, tasks, teams, membership, comments, activity, chat messages, uploaded images, and database-backed sessions. |
| Docker | Packages the frontend and backend into portable container images. |
| Docker Hub | Stores the built frontend and backend images. |
| GitHub Actions | Runs the build pipeline and updates image tags in the Kubernetes manifests. |
| Kubernetes / K3s | Runs application workloads, Services, storage resources, and monitoring components. K3s is the lightweight Kubernetes distribution used on EC2. |
| Deployments and Services | Manage pod replicas and provide stable internal addresses for the frontend, backend, and database. |
| PersistentVolumes and PersistentVolumeClaims | Keep database files outside the PostgreSQL container's writable layer. The current database volume uses local EC2 storage. |
| Ingress NGINX | Current public HTTP/HTTPS entry point; routes the hostname to the frontend and API and uses the TLS Secret. |
| cert-manager and Let's Encrypt | Request and renew the TLS certificate. A staging certificate tested validation before the production certificate was issued. |
| DuckDNS | Provides the free hostname pointing to the EC2 public IP. |
| Helm | Installs and manages chart-based components such as Traefik, Prometheus, and Grafana. |
| Argo CD | Reconciles Kubernetes resources against manifests in GitHub using GitOps. |
| Prometheus | Collects Kubernetes and node metrics for queries, dashboards, and alert conditions. |
| Grafana | Visualizes metrics and evaluates alert rules. |

## Application capabilities

### Accounts and profiles

The backend supports registration, login, current-user lookup, profile updates, avatar retrieval, and logout. Passwords are stored as BCrypt hashes. Authentication uses server-side sessions rather than JWTs. The frontend obtains a CSRF token before sending state-changing requests.

Profile images can be selected from the included doodle avatars, supplied as an HTTP(S) image URL, or uploaded as a PNG, JPEG, or WebP image. Uploaded profile images are compressed in the browser and stored in PostgreSQL.

### Tasks

Users can list, create, update, and delete personal tasks. Tasks have a title, description, and status. The API validates task titles and descriptions and restricts statuses to `TODO`, `IN_PROGRESS`, and `DONE`.

Team tasks have their own endpoints. Team members can update shared task status and add comments. Task activity records changes for the team workspace.

### Teams and chat

Users can create teams and join them using a team code. The team API exposes membership, team tasks, comments, and recent activity. Team chat messages can contain text, an image, or both. The frontend polls the chat endpoint periodically; this is polling-based chat, not WebSocket-based real-time messaging. Image data and chat messages are currently stored in PostgreSQL.

## Repository layout

~~~text
.
├── .github/
│   └── workflows/
│       └── ci.yml                   # Build, image push, and GitOps tag update
├── backend/
│   ├── Dockerfile                   # Multi-stage Maven/JRE build
│   ├── pom.xml                      # Spring dependencies and Java version
│   └── src/
│       ├── main/java/com/example/demo/
│       │   ├── config/              # Spring Security configuration
│       │   ├── controller/          # Auth, task, and team APIs
│       │   ├── dto/
│       │   ├── model/               # JPA entities
│       │   └── repository/          # Spring Data repositories
│       └── main/resources/
│           ├── application.properties
│           └── session-schema-postgresql.sql
├── frontend/
│   ├── Dockerfile                   # Vite build followed by NGINX runtime
│   ├── nginx.conf                   # Static files, SPA fallback, and API proxy
│   ├── package.json
│   └── src/                         # React application and team workspace
└── k8s-manifests/
    ├── backend-deployment.yaml
    ├── db-deployment.yaml
    ├── db-service.yaml
    ├── frontend-deployment.yaml
    ├── ingress.yaml                 # Current NGINX Ingress and TLS
    └── traefik-ingress.yaml         # Parallel migration route, under test
~~~

Some cluster resources were created directly on EC2 and are not yet managed from this repository. These include the database Secret and volume definitions, the backup volume and CronJob, Helm values for monitoring, cert-manager issuers/certificate objects, and parts of the Traefik installation. The production TLS private key is stored in a Kubernetes Secret, not in GitHub.

## CI pipeline and image tags

The workflow is defined in `.github/workflows/ci.yml`. It runs on pushes and pull requests targeting `main`.

The pipeline uses GitHub Actions with Docker Buildx. It builds the frontend from `./frontend` and the backend from `./backend`. On a push to `main`, each image is pushed to Docker Hub using both `latest` and the short Git commit SHA. The SHA tag makes it possible to identify the image associated with a source revision; `latest` is convenient for manual testing but is not a stable release identifier.

The workflow updates `k8s-manifests/backend-deployment.yaml` and `k8s-manifests/frontend-deployment.yaml` to use the new SHA-tagged images. It commits the GitOps update with `[skip ci]` so that the generated commit does not trigger another build. Docker Hub credentials are supplied through GitHub Actions secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`. These values must be configured in repository settings and must never be committed to source control.

The backend Dockerfile currently runs Maven packaging with `-DskipTests`, and the GitHub Actions workflow does not run a separate unit-test stage. The current backend test tree contains a Spring application context-load test, but the automated pipeline should not be described as a comprehensive test suite.

## Kubernetes deployment

The application runs on a single K3s node hosted by an AWS EC2 instance. The single-node layout is useful for a small project but is not highly available: the application, database, and cluster control plane share the same machine.

The frontend and backend Services are configured as `ClusterIP`. The database Service is also internal and listens on port 5432. The Ingress controller is the public entry point. The backend listens on port 8080, while the frontend container serves HTTP on port 80.

The backend deployment receives its database username and password through the Kubernetes Secret `db-credentials`. The connection is configured for PostgreSQL Service `taskflow-db` and database `taskflow`. Keep this Secret out of Git and rotate credentials if they have ever been committed or otherwise exposed.

The PostgreSQL Deployment uses a persistent volume claim named `taskflow-db-pvc`. The live cluster's database volume uses local storage on the EC2 node. A database pod restart does not necessarily erase data, but loss of the node or its disk can still lose both the database and its local backups.

## GitOps with Argo CD

Argo CD is installed in the `argocd` namespace. Its `taskflow` Application was previously observed as `Synced` and `Healthy`. The intended source is this repository's `k8s-manifests/` directory on the `main` branch.

Argo CD compares the live cluster with the resources declared in Git and can apply changes during synchronization. The CI workflow changes image tags in Git; Argo CD is responsible for reconciling those manifest changes in the cluster. This keeps application delivery separate from image building.

Argo CD's browser interface has been accessed through a local SSH port-forward. Direct SSH from the Windows workstation is currently timing out on TCP port 22 even though the instance remains reachable through AWS EC2 Instance Connect. The SSH-tunnel issue does not, by itself, show that the Argo CD application or TaskFlow website is down.

## Monitoring and alerting

Prometheus and Grafana were installed with Helm in the `monitoring` namespace. Prometheus collects node and Kubernetes metrics, including metrics from the API server, kubelet/cAdvisor, node exporter, and kube-state-metrics. The Prometheus data source was tested successfully in Grafana, and the dashboards showed live values.

The TaskFlow Grafana dashboard includes node CPU usage, memory usage, container restart counts for TaskFlow pods, and available replicas for the backend, frontend, and database Deployments.

Alert rules were created for high node CPU, high memory usage, and TaskFlow Deployments with no available replicas. The configured examples use CPU above 80% for five minutes, memory above 85% for five minutes, and available replicas below one. The alert contact point was configured in Grafana; actual email delivery depends on a correctly configured notification channel and SMTP setup. A successful metrics query alone does not guarantee that notifications reach an inbox.

Useful checks:

~~~bash
# Cluster and application resources
sudo kubectl get nodes -o wide
sudo kubectl get pods -A
sudo kubectl get deployments,services -n default
sudo kubectl get ingress -n default

# Certificate and controller status
sudo kubectl get certificate -n default
sudo kubectl get pods -n cert-manager
sudo kubectl get pods -n ingress-nginx
sudo kubectl get pods -n traefik

# Monitoring resources
sudo kubectl get pods,pvc -n monitoring
sudo kubectl get svc -n monitoring
~~~

## Database backup and restore

A PostgreSQL backup CronJob was created in the cluster, with dump files written to a mounted backup volume. A backup test produced a PostgreSQL dump under `/backups`, and the file was visible on the EC2 host under `/mnt/data/taskflow-backups`. A restore test created a temporary PostgreSQL pod, restored a dump, and queried the database's public tables.

The backup resources are currently maintained outside the checked-in manifest directory, so a new cluster cannot be rebuilt entirely from this repository alone. The backup path is on the same EC2 host as the database. For stronger disaster recovery, the backup should also be copied to storage outside the instance, such as an encrypted S3 bucket, and restore tests should be repeated periodically.

## TLS and ingress migration status

The current public entry point is Ingress NGINX. cert-manager was installed in the cluster, and two ClusterIssuers were created for Let's Encrypt staging and production. The staging certificate validated the HTTP-01 challenge; the production Certificate `taskflowteams-production` was observed as ready and stored in the Secret `taskflowteams-tls`.

The live Ingress uses the hostname `taskflowteams.duckdns.org`, serves HTTPS on port 443, and redirects HTTP on port 80 to HTTPS. DuckDNS points the hostname to the EC2 public IPv4 address. Do not commit the private key in `taskflowteams-tls` or the DuckDNS API token to GitHub.

A Traefik Helm release has also been installed alongside the existing controller. Its pod was observed running and a separate `traefik` IngressClass exists. The repository contains `k8s-manifests/traefik-ingress.yaml` for a parallel test route, but the Traefik Service configuration and end-to-end HTTPS path have not been fully verified. The existing NGINX route remains the confirmed live entry point; don't remove it until Traefik has passed route, certificate, API, and browser tests.

This migration is needed because the Kubernetes community retired Ingress NGINX on March 24, 2026. The retired project no longer receives new releases or security fixes. See the [Kubernetes Ingress NGINX retirement notice](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/).

## Local development

Required tools: Node.js 22 or compatible, npm, Java 17, Maven (or the included Maven wrapper), and PostgreSQL. Docker is optional for local development but required to build images.

### Backend

Create a local PostgreSQL database and user, then set the environment variables used by `backend/src/main/resources/application.properties`:

~~~bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=taskflow
export DB_USER=taskflow_user
export DB_PASSWORD='replace-with-a-local-password'

cd backend
./mvnw spring-boot:run
~~~

On Windows, run `mvnw.cmd spring-boot:run` from the `backend` directory after setting the same environment variables in PowerShell. The backend listens on port 8080 by default.

The application properties use Hibernate's `ddl-auto=update` for schema updates and enable SQL logging. These are convenient for development; production database migration and logging settings should be reviewed before a production release. Do not rely on the example fallback database password from `application.properties` for a deployed system; provide credentials through protected environment variables or a secret manager.

### Frontend

~~~bash
cd frontend
npm ci
npm run dev
~~~

Vite serves the frontend on its development port. The application uses same-origin `/api` requests, but the current `vite.config.js` does not define a development proxy. For an integrated local run, configure Vite to proxy `/api` to `http://localhost:8080`, or use the production frontend container whose NGINX configuration includes the API proxy.

### Build container images

From the repository root:

~~~bash
docker build -t taskflow-frontend:local ./frontend
docker build -t taskflow-backend:local ./backend
~~~

The frontend build uses `npm ci` and `npm run build`, then copies the generated `dist/` files into an NGINX runtime image. The backend build uses Maven with Eclipse Temurin Java 17 to build the JAR, then copies that JAR into a Java 17 JRE image.

## Verification performed

The following checks have been observed during deployment and troubleshooting:

- GitHub Actions completed successfully for the application image and manifest-update workflow.
- Frontend and backend Services were changed to internal `ClusterIP` Services.
- The production certificate resource reached `READY=True`.
- `curl -I http://taskflowteams.duckdns.org/` returned `308 Permanent Redirect`.
- `curl -I https://taskflowteams.duckdns.org/` returned `HTTP/2 200` without bypassing certificate validation.
- Grafana successfully queried Prometheus and displayed node CPU, memory, container restarts, and available TaskFlow replicas.
- A PostgreSQL backup was created, restored into a temporary test database pod, and its tables were listed.

These are deployment checks, not a claim that the project has exhaustive automated coverage. Add automated backend tests, frontend tests, security scanning, and an end-to-end smoke test to the CI workflow before relying on it for production changes.

## Current limitations and next work

1. **Finish the Traefik migration.** Validate the Service type and temporary NodePorts, test the new Ingress route over HTTPS, then switch public traffic only after the replacement works. Remove the retired controller after the new route is confirmed.
2. **Make infrastructure setup repeatable.** Check the database volume, backup volume, CronJob, Secret references, cert-manager issuers, certificate, and monitoring Helm values into an appropriate deployment structure. Keep secrets out of Git and use a secret manager or sealed/external-secret approach.
3. **Move backups off the EC2 node.** Local backups protect against some database errors, but not against loss of the instance or its attached storage.
4. **Add automated tests to CI.** The current Docker build skips backend tests, and the workflow does not run a frontend test suite.
5. **Review production settings.** Replace development fallback credentials, review Hibernate schema-update behavior and SQL logging, set resource requests and limits based on measurements, and verify notification delivery.
6. **Plan for availability.** The current K3s cluster has a single node and local persistent storage. It is useful for a learning and demonstration environment, but it does not provide node-level high availability.
7. **Restore workstation access to Argo CD.** The Argo CD application was previously healthy, but the Windows SSH tunnel currently times out on TCP port 22. AWS EC2 Instance Connect remains the available administration path while networking is investigated.

## References

- [TaskFlow repository](https://github.com/WarManWarrior/TaskFlow_Platform)
- [K3s documentation](https://docs.k3s.io/)
- [Kubernetes documentation](https://kubernetes.io/docs/)
- [GitHub Actions documentation](https://docs.github.com/actions)
- [Argo CD documentation](https://argo-cd.readthedocs.io/)
- [Prometheus documentation](https://prometheus.io/docs/)
- [Grafana documentation](https://grafana.com/docs/)
- [cert-manager HTTP-01 documentation](https://cert-manager.io/docs/configuration/acme/http01/)
- [Kubernetes Ingress NGINX retirement notice](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/)
