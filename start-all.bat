@echo off
echo Starting all services...

:: Start API Gateway
cd api-gateway
start cmd /k "npm run start:gateway"
cd ..

:: Start Service 1
cd order-service
start cmd /k "npm run start:order"
cd ..

:: Start Service 2
cd user-service
start cmd /k "npm run start:user"
cd ..


echo All services started!
echo API Gateway: http://localhost:3000
echo Service 1: http://localhost:3001
echo Service 2: http://localhost:3002
pause