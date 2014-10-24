var express = require('express');
var router = express.Router();


router.get('/', function(req, res) {
  res.render('index.html');
});

router.get('/:random', function(req, res) {
  res.send('<h1>lol what are you doing trying to get to /' + req.params.random + ' ??</h1>');
});

module.exports = router;
