
exports.signUp = function(db, username, password, callback)
{
	var users = db.get('users');
	var promise = users.insert({ username: username, password: password });
	promise.on('complete', function(err, doc) {
		callback(err, doc);
	});
}