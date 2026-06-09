// fenceCtrl.js — Controlador para Posicionamiento de Cercas
var fenceCtrl = angular.module('fenceCtrl', ['geolocation']);
fenceCtrl.controller('fenceCtrl', function ($scope, $http, $rootScope, $timeout, geolocation, gservice) {

    // Coordenadas por defecto: zona ganadera de Matagalpa, Nicaragua
    $scope.formData = {
        paddock  : 0,
        point    : 0,
        version  : 0,
        latitude : 12.9256,
        longitude: -85.9175
    };
    $scope.fencePoints = [];

    // -------------------------------------------------------
    // Inicializar mapa después de que Angular renderice el partial
    // -------------------------------------------------------
    $timeout(function () {
        gservice.refresh($scope.formData.latitude, $scope.formData.longitude, false);
    }, 150);

    // Intentar usar geolocalización real
    geolocation.getLocation().then(function (data) {
        $scope.formData.latitude  = parseFloat(data.coords.latitude).toFixed(6);
        $scope.formData.longitude = parseFloat(data.coords.longitude).toFixed(6);
        gservice.refresh(data.coords.latitude, data.coords.longitude, false);
    }).catch(function () { /* Sin permiso — usar por defecto */ });

    // Cargar puntos de cerca al arrancar
    loadFencepoints();

    // -------------------------------------------------------
    // Funciones privadas
    // -------------------------------------------------------
    function loadFencepoints() {
        $.getJSON('/fencepoints', function (data) {
            $scope.$apply(function () {
                $scope.fencePoints = data;
                $scope.formData.point = data.length;
                $scope.formData.version = data.length > 0 ? data[0].version : 0;
            });
        });
    }

    // -------------------------------------------------------
    // API pública del scope
    // -------------------------------------------------------

    /** Recarga la lista y refresca el mapa */
    $scope.updatelist = function () {
        loadFencepoints();
        gservice.refresh($scope.formData.latitude, $scope.formData.longitude, false);
    };

    /** Agregar nuevo punto de cerca (coordenadas tomadas del clic en el mapa) */
    $scope.addPoint = function () {
        var pointData = {
            paddock : parseInt($scope.formData.paddock),
            order   : parseInt($scope.formData.point),
            version : parseInt($scope.formData.version),
            location: [parseFloat($scope.formData.longitude), parseFloat($scope.formData.latitude)]
        };
        $http.post('/fencepoints/add', pointData)
            .then(function (res) {
                $scope.fencePoints = res.data;
                $scope.formData.point = res.data.length;
                gservice.refresh($scope.formData.latitude, $scope.formData.longitude, false);
            }, function () {
                console.error('Error al agregar punto de cerca');
            });
    };

    /** Eliminar punto de cerca por ID */
    $scope.deletePoint = function (id2Delete) {
        $http.post('/fencepoints/delete', { _id: id2Delete })
            .then(function (res) {
                $scope.fencePoints = res.data;
                gservice.refresh($scope.formData.latitude, $scope.formData.longitude, false);
            }, function () {
                console.error('Error al eliminar punto de cerca');
            });
    };

    /** Incrementar versión y enviar a collares */
    $scope.send2Devices = function () {
        var newVersion = (parseInt($scope.formData.version) + 1) % 256;
        $http.post('/fencepoints/update', {
            paddock: parseInt($scope.formData.paddock),
            version: newVersion
        }).then(function (res) {
            $scope.fencePoints = res.data;
            $scope.formData.version = newVersion;
            gservice.refresh($scope.formData.latitude, $scope.formData.longitude, false);
        }, function () {
            console.error('Error al actualizar versión');
        });
    };

    // Escuchar clic en mapa → actualizar coordenadas del formulario
    $rootScope.$on('clicked', function () {
        $scope.$apply(function () {
            $scope.formData.latitude  = parseFloat(gservice.clickLat).toFixed(6);
            $scope.formData.longitude = parseFloat(gservice.clickLong).toFixed(6);
        });
    });
});