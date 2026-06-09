angular.module('alertsCtrl', [])
    .controller('alertsCtrl', function($scope, $http, $timeout, $location) {

        $scope.alerts = [];
        $scope.animals = [];

        $scope.getAlertClass = function(severity) {
            if (severity === 'danger') return 'danger border-danger';
            if (severity === 'warning') return 'warning border-warning';
            return 'info border-info';
        };

        $scope.getIcon = function(type) {
            if (type === 'geofence') return 'fa fa-map-marker text-warning';
            if (type === 'health') return 'fa fa-heartbeat text-danger';
            if (type === 'lora_offline') return 'fa fa-signal text-danger';
            return 'fa fa-bell text-info';
        };

        $scope.getAnimalName = function(id) {
            var animal = $scope.animals.find(function(a) { return a._id === id; });
            return animal ? animal.name : id;
        };

        $scope.locateAnimal = function(animalId) {
            // Ir al mapa y emitir evento para buscar el animal
            $location.path('/map');
            setTimeout(function() {
                // Pequeño hack para asegurar que el controlador del mapa cargó
                var scope = angular.element(document.querySelector('.right-pane')).scope();
                if (scope && scope.findAnimalDirectly) {
                    scope.findAnimalDirectly(animalId);
                }
            }, 500);
        };

        function loadData() {
            $http.get('/animals/list').then(function(res) {
                $scope.animals = res.data;
            });
            $http.get('/alerts/active').then(function(res) {
                $scope.alerts = res.data;
            });
        }

        var pollPromise;
        function pollData() {
            loadData();
            pollPromise = $timeout(pollData, 10000);
        }

        pollData();

        $scope.$on('$destroy', function() {
            if (pollPromise) $timeout.cancel(pollPromise);
        });
    });
