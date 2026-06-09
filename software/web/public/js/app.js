// app.js

// Declares the initial angular module "meanMapApp". Module grabs other controllers and services. Note the use of ngRoute.
var app = angular.module('OpenFence', ['addCtrl', 'queryCtrl', 'fenceCtrl','collarCtrl', 'trackingCtrl', 'statisticsCtrl', 'settingsCtrl', 'geolocation', 'gservice', 'ngRoute'])

    // Configures Angular routing -- showing the relevant view and controller when needed.
    .config(function($routeProvider){

        // Overview
        $routeProvider.when('/overview', {
            controller: 'addCtrl',
            templateUrl: 'partials/overview.html',

        }).when('/map', {
            controller: 'fenceCtrl',
            templateUrl: 'partials/map.html',
            
        }).when('/collars', {
            controller: 'collarCtrl',  
            templateUrl: 'partials/collars.html',

        }).when('/tracking', {
            controller: 'trackingCtrl',
            templateUrl: 'partials/tracking.html',

        }).when('/statistics', {
            controller: 'statisticsCtrl',
            templateUrl: 'partials/statistics.html',
            
        }).when('/settings', {
            controller: 'settingsCtrl',
            templateUrl: 'partials/settings.html',
            
            // All else forward to the Join Team Control Panel
        }).otherwise({redirectTo:'/overview'})
    });
