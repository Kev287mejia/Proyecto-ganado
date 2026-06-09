// settingsCtrl.js - Controlador de Configuración para GeoGanado
var settingsCtrl = angular.module('settingsCtrl', []);

settingsCtrl.controller('settingsCtrl', function ($scope, $http, $timeout) {

    $scope.animals = [];
    $scope.selectedAnimal = null;
    $scope.simResult = null;
    
    // Estados de carga
    $scope.isSimulating = false;
    $scope.isResetting = false;
    
    // Notificaciones flotantes
    $scope.toast = null;
    var toastTimeout = null;

    // Cargar animales al iniciar
    loadAnimals();

    function loadAnimals() {
        $.getJSON('/animals/list', function (data) {
            $scope.$apply(function () {
                $scope.animals = [{ name: 'Seleccionar al azar', id: null }].concat(
                    data.map(function (a) { return { name: a.name, id: a._id }; })
                );
                $scope.selectedAnimal = $scope.animals[0];
            });
        });
    }

    /** Muestra una alerta temporal tipo toast en la UI */
    function showToast(message, type) {
        if (toastTimeout) {
            $timeout.cancel(toastTimeout);
        }
        $scope.toast = {
            message: message,
            type: type || 'toast-success' // toast-success, toast-danger, toast-info
        };
        toastTimeout = $timeout(function () {
            $scope.toast = null;
        }, 4000);
    }

    /** Envía una petición de simulación de coordenadas al servidor */
    $scope.runSimulation = function () {
        $scope.isSimulating = true;
        $scope.simResult = null;

        var reqBody = {
            animalID: $scope.selectedAnimal ? $scope.selectedAnimal.id : null
        };

        $http.post('/db/simulate', reqBody)
            .then(function (res) {
                $scope.isSimulating = false;
                if (res.data && res.data.success) {
                    $scope.simResult = res.data;
                    
                    var tracking = res.data.tracking;
                    var name = res.data.animalName;
                    var detail = "Coordenadas recibidas para " + name + ". ";
                    if (tracking.shocks > 0) {
                        detail += "⚠️ ¡FUERA DE LÍMITES! Se activó una descarga.";
                        showToast(detail, 'toast-danger');
                    } else if (tracking.alerts > 0) {
                        detail += "⚠️ ¡Cerca del límite! Se emitió un sonido de advertencia.";
                        showToast(detail, 'toast-warn');
                    } else {
                        detail += "✓ Dentro del perímetro seguro.";
                        showToast(detail, 'toast-success');
                    }
                } else {
                    showToast("Error inesperado en el servidor", "toast-danger");
                }
            }, function (err) {
                $scope.isSimulating = false;
                var errMsg = err.data && err.data.error ? err.data.error : "Error de red al simular";
                showToast(errMsg, 'toast-danger');
            });
    };

    /** Restablece la base de datos completa a su estado semilla inicial */
    $scope.resetDB = function () {
        if (!confirm("¿Estás seguro de que deseas restablecer toda la base de datos? Se perderán las cercas dibujadas y el historial actual.")) {
            return;
        }

        $scope.isResetting = true;
        $scope.simResult = null;

        $http.post('/db/reset', {})
            .then(function (res) {
                $scope.isResetting = false;
                showToast("¡Base de datos restablecida correctamente a datos semilla!", 'toast-success');
                // Recargar el listado de animales
                loadAnimals();
            }, function (err) {
                $scope.isResetting = false;
                var errMsg = err.data && err.data.error ? err.data.error : "Error de red al restablecer";
                showToast(errMsg, 'toast-danger');
            });
    };
});
