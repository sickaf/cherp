var uriUtil = require('mongodb-uri');

module.exports = {
	'url' : uriUtil.formatMongoose('mongodb://admin:meat69spin@ds047940.mongolab.com:47940/cherp'),
	'options': { server: { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } }, 
                replset: { socketOptions: { keepAlive: 1, connectTimeoutMS : 30000 }}}
};