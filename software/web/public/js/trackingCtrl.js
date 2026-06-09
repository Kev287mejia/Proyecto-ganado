// trackingCtrl.js — Controlador para Vista de Mapa / Seguimiento
var trackingCtrl = angular.module('trackingCtrl', ['geolocation']);
trackingCtrl.controller('trackingCtrl', function ($scope, $http, $rootScope, $timeout, $interval, geolocation, gservice) {

    // Coordenadas por defecto: zona ganadera de Matagalpa, Nicaragua
    $scope.formData = {
        paddock  : 0,
        point    : 0,
        version  : 0,
        latitude : 12.9256,
        longitude: -85.9175
    };
    $scope.animals        = [];
    $scope.selectedAnimal = null;
    $scope.trackingData   = [];
    $scope.queryCount     = 0;
    $scope.lastUpdate     = null;

    var autoRefreshInterval = null;

    // -------------------------------------------------------
    // Inicializar mapa después de que Angular renderice el partial
    // -------------------------------------------------------
    $timeout(function () {
        loadTrackingAndRefresh();
    }, 150);

    // Intentar geolocalización real
    geolocation.getLocation().then(function (data) {
        $scope.formData.latitude  = parseFloat(data.coords.latitude).toFixed(6);
        $scope.formData.longitude = parseFloat(data.coords.longitude).toFixed(6);
    }).catch(function () { /* usar coordenadas por defecto */ });

    // Cargar animales para el selector
    $.getJSON('/animals/list', function (data) {
        $scope.$apply(function () {
            $scope.animals = [{ name: 'Todos', id: null }].concat(
                data.map(function (a) { return { name: a.name, id: a._id }; })
            );
            $scope.selectedAnimal = $scope.animals[0];
        });
    });

    // Configurar fechas del filtro
    var now = new Date();
    now.setMilliseconds(0);
    now.setSeconds(0);
    $scope.formData.newestDate = now;
    $scope.formData.oldestDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Últimas 24h

    // Auto-refresco cada 30 segundos
    autoRefreshInterval = $interval(function () {
        if ($scope.selectedAnimal && $scope.selectedAnimal.id) {
            // Si hay filtro activo, no auto-refrescar para no perder la selección
            return;
        }
        loadTrackingAndRefresh();
    }, 30000);

    // Limpiar intervalo al destruir el scope (cambio de ruta)
    $scope.$on('$destroy', function () {
        if (autoRefreshInterval) { $interval.cancel(autoRefreshInterval); }
    });

    // -------------------------------------------------------
    // Funciones privadas
    // -------------------------------------------------------

    function loadTrackingAndRefresh() {
        $.getJSON('/tracking/list', function (data) {
            $scope.$apply(function () {
                $scope.trackingData = data;
                $scope.queryCount   = data.length;
                $scope.lastUpdate   = new Date().toLocaleTimeString('es-MX');
            });
            gservice.refreshAnimals($scope.formData.latitude, $scope.formData.longitude, data);
        }).fail(function () {
            gservice.initMap($scope.formData.latitude, $scope.formData.longitude);
        });
    }

    // -------------------------------------------------------
    // API pública del scope
    // -------------------------------------------------------

    /** Refresca manualmente el mapa y la tabla */
    $scope.refresh = function () {
        loadTrackingAndRefresh();
    };

    /** Filtra tracking por fecha y animal seleccionado */
    $scope.queryAnimals = function () {
        var body = {
            oldestDate: $scope.formData.oldestDate,
            newestDate: $scope.formData.newestDate,
            animalID  : $scope.selectedAnimal ? $scope.selectedAnimal.id : null
        };
        $http.post('/tracking/list', body)
            .then(function (res) {
                $scope.trackingData = res.data;
                $scope.queryCount   = res.data.length;
                $scope.lastUpdate   = new Date().toLocaleTimeString('es-MX');
                gservice.refreshAnimals($scope.formData.latitude, $scope.formData.longitude, res.data);
            }, function () {
                console.error('Error al consultar tracking');
            });
    };

    // Escuchar clic en mapa → actualizar coordenadas
    $rootScope.$on('clicked', function () {
        $scope.$apply(function () {
            $scope.formData.latitude  = parseFloat(gservice.clickLat).toFixed(6);
            $scope.formData.longitude = parseFloat(gservice.clickLong).toFixed(6);
        });
    });
});