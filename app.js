const express = require("express")
const session = require("express-session")
const dotenv = require("dotenv")
const bodyParser = require("body-parser")
const cookieParser = require('cookie-parser')
const expressValidator = require("express-validator")
const errorHandler = require("error-handler")
const ejs = require("ejs")
const firebase = require("firebase-admin")
const crypto = require("crypto")
const FirebaseStore = require("connect-session-firebase")(session)
const helmet = require('helmet')
const csurf = require("csurf")

const serviceAccount = require("./credentials.json")
// Ignore shopify-crp project name, cannot be changed.
const ref = firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://shopify-crp.firebaseio.com"
});

dotenv.load({path: '.env'})
var csrfProtection = csurf()

const app = express()
app.use(helmet({
  frameguard: false
}))

const routes = {
    functions: require("./routes/functions.js"),
    test: require("./routes/test.js"),
    main: require("./routes/main.js"),
    auth: require("./routes/auth.js")
}

app.set('port', process.env.PORT || 3000);

app.set('views', './views')
app.set('view engine', 'ejs')
app.enable('trust proxy')
app.set('trust proxy', 1)

// app.use(bodyParser.json());
app.use(bodyParser.json({
  verify: function(req, res, buf, encoding) {
    var shopHMAC = req.get('x-shopify-hmac-sha256');
    if (!shopHMAC) return;
    if (req.get('x-kotn-webhook-verified')) throw "Unexpected webhook verified header";
    var dSecret = process.env.API_SECRET;
    var digest = crypto.createHmac('SHA256', dSecret).update(buf.toString(encoding)).digest('base64');
    if (digest == req.get('x-shopify-hmac-sha256')) {
      req.headers['x-kotn-webhook-verified'] = '200';
    }
  }
}));


app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());
app.use(express.static('./public'))
app.use(session({
  store: new FirebaseStore({
    database: ref.database()
  }),
  secret: "notActuallyTheSecret",
  resave: true,
  rolling: true,
  name: 'curate_cki',
  saveUninitialized: false,
  cookie: { secure: true,
            httpOnly: true
  }
}))
// app.use(csurf())

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
  res.header('Access-Control-Expose-Headers', 'Content-Length');
  res.header('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type, X-Requested-With, Range');
  next()
})


app.use(function(req, res, next) {
  res.successT = function(data) {
    data = data || {}
    data.success = true
    res.json(data)
  }

  res.errorT = function(error) {
    error = error.description || error

    res.json({
      success: false,
      status: 1,
      message: error
    })
  }

  res.renderT = function(template, data) {
    data = data || {}
    data.host = req.protocol + "://" + req.hostname
    data.url = data.host + req.url
    data.template = data.template || template
    data.random = Math.random().toString(36).slice(2)
    res.render(template, data)
  }

  next()
})


// GET REQUESTS (Page rendering, redirects, other non-database-modifying functions)
app.get('/install', routes.main.install )
app.get('/', routes.main.index )
app.get('/verify', routes.main.verify)
app.get('/dashboard', csrfProtection, routes.auth.setSession, routes.auth.checkPayment, routes.main.dashboard)
app.get('/groups', csrfProtection, routes.auth.setSession, routes.auth.checkPayment, routes.main.groups)
app.get('/settings', csrfProtection, routes.auth.setSession, routes.auth.checkPayment, routes.main.settings)
app.get('/help', routes.auth.setSession, routes.auth.checkPayment, routes.main.help)

app.get('/payment', routes.auth.setSession, routes.main.makePayment, routes.auth.checkPayment, routes.main.dashboard)
app.get('/activate', routes.auth.setSession, routes.auth.activatePayment )

app.get('/getProductData', routes.functions.getProductData)

app.get('/enableSafariCookies', routes.auth.enableSafariCookies)



// TESTING ROUTES
app.get('/write', routes.test.writeMeta)
app.get('/writeGroup', routes.test.writeGroup)
app.get('/delete', routes.test.delete)
app.get('/meta', routes.test.metafields)


// POST REQUESTS
app.post('/saveProducts', csrfProtection, routes.functions.saveProducts)
app.post('/saveGroups', csrfProtection, routes.functions.saveGroups)
app.post('/deleteGroups', csrfProtection, routes.functions.deleteGroups)
app.post('/saveSettings', csrfProtection, routes.auth.setSession, routes.functions.saveSettings)
app.post('/uninstall', routes.functions.uninstall )



const server = app.listen(app.get('port'), () => {
  console.log('Express server listening on port %d in %s mode: http://localhost:%s', app.get('port'), app.get('env'), app.get('port'));
})
