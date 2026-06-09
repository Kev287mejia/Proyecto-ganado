// addCtrl.js — Controlador para Vista General (overview)
var addCtrl = angular.module('addCtrl', ['geolocation']);
addCtrl.controller('addCtrl', function ($scope, $http, $rootScope, $timeout, geolocation, gservice) {

    // Coordenadas por defecto: zona ganadera de Matagalpa, Nicaragua
    $scope.formData = {
        paddock  : 0,
        point    : 0,
        version  : 0,
        latitude : 12.9256,
        longitude: -85.9175
    };
    $scope.animals       = [];
    $scope.selectedAnimal = null;
    $scope.trackingData  = [];
    $scope.lastUpdate    = null;

    // -------------------------------------------------------
    // Inicializar mapa una vez que Angular haya renderizado el partial
    // -------------------------------------------------------
    $timeout(function () {
        // Cargar datos de tracking y animales, luego inicializar mapa
        $.getJSON('/tracking/list', function (data) {
            $scope.trackingData = data;

            if (data && data.length > 0) {
                // refreshAnimals carga la info y llama initMap internamente
                gservice.refreshAnimals($scope.formData.latitude, $scope.formData.longitude, data);
            } else {
                // Si no hay tracking, solo mostrar cercas
                gservice.refresh($scope.formData.latitude, $scope.formData.longitude, false);
            }
        }).fail(function () {
            gservice.initMap($scope.formData.latitude, $scope.formData.longitude);
        });
    }, 150);

    // Intentar usar geolocalización real del usuario
    geolocation.getLocation().then(function (data) {
        $scope.formData.latitude  = parseFloat(data.coords.latitude).toFixed(6);
        $scope.formData.longitude = parseFloat(data.coords.longitude).toFixed(6);
    }).catch(function () { /* Sin permiso de geolocalización — usar coordenadas por defecto */ });

    // Cargar lista de animales para el selector
    $.getJSON('/animals/list', function (data) {
        $scope.$apply(function () {
            $scope.animals = [{ name: 'Todos', id: null }].concat(
                data.map(function (a) { return { name: a.name, id: a._id }; })
            );
            $scope.selectedAnimal = $scope.animals[0];
        });
    });

    // Cargar fecha actual en los filtros
    var now = new Date();
    now.setMilliseconds(0);
    now.setSeconds(0);
    $scope.formData.newestDate = now;
    $scope.formData.oldestDate = now;

    // -------------------------------------------------------
    // Funciones
    // -------------------------------------------------------

    /** Refresca mapa y tabla con el último tracking */
    $scope.refresh = function () {
        $.getJSON('/tracking/list', function (data) {
            $scope.$apply(function () {
                $scope.trackingData = data;
                $scope.lastUpdate   = new Date().toLocaleTimeString('es-MX');
            });
            gservice.refreshAnimals($scope.formData.latitude, $scope.formData.longitude, data);
        });
    };

    /** Filtra animales por fecha / ID */
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
                gservice.refreshAnimals($scope.formData.latitude, $scope.formData.longitude, res.data);
            }, function () {
                console.error('Error al consultar tracking');
            });
    };

    // Escuchar clic en el mapa para actualizar coordenadas
    $rootScope.$on('clicked', function () {
        $scope.$apply(function () {
            $scope.formData.latitude  = parseFloat(gservice.clickLat).toFixed(6);
            $scope.formData.longitude = parseFloat(gservice.clickLong).toFixed(6);
        });
    });
});