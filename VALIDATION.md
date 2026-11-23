# Rentora validation

- Java 21 compilation: passed.
- Backend integration suite: 12 tests, 0 failures, 0 errors.
- Maven executable JAR packaging: passed.
- React/Vite production build: passed.
- Live HTTP check through the Vite proxy: passed for registration, session cookies and CSRF, booking creation, overlapping date rejection, customer/admin access control, admin approval, customer history, overdue return fees, and logout.

Database integration tests and the live HTTP check used isolated H2 databases in MySQL compatibility mode. The application is configured for MySQL during normal startup; connection to your installed MySQL server must be checked on your laptop. A full automated visual browser test was not completed in this environment.
