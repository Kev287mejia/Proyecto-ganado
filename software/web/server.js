// Dependencies
// -----------------------------------------------------
var express         = require('express');
var port            = process.env.PORT || 3000;
var morgan          = require('morgan');
var bodyParser      = require('body-parser');
var methodOverride  = require('method-override');
var app             = express();

// Express Configuration
// -----------------------------------------------------
// Logging and Parsing
app.use(express.static(__dirname + '/public'));
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.text());
app.use(bodyParser.json({ type: 'application/vnd.api+json'}));
app.use(methodOverride());

// Routes
// ------------------------------------------------------
require('./app/routes.js')(app);
require('./app/animal-routes.js')(app);
require('./app/animallocation-routes.js')(app);

// Listen
// -------------------------------------------------------
app.listen(port);
console.log('✅ OpenFence corriendo en http://localhost:' + port);
console.log('📁 Base de datos: archivos JSON (sin MongoDB)');