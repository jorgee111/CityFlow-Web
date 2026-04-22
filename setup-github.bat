:: Script para conectar el repositorio local a GitHub
:: Ejecuta este script UNA VEZ después de crear el repo en github.com

@echo off
echo.
echo  Pasos para conectar a GitHub:
echo  1. Ve a: https://github.com/new
echo  2. Nombre del repositorio: CityFlow-Web
echo  3. Descripcion: Sistema gestion transporte publico Madrid
echo  4. Visibilidad: Public o Private (a tu elección)
echo  5. NO marques "Initialize this repository" (ya tiene commits)
echo  6. Copia la URL del repositorio (ej: https://github.com/TuUsuario/CityFlow-Web.git)
echo  7. Vuelve aqui y ejecuta:
echo.
echo     git remote add origin https://github.com/TU_USUARIO/CityFlow-Web.git
echo     git branch -M main
echo     git push -u origin main
echo.
pause
