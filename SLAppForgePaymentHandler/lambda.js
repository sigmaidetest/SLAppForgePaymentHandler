let AWS = require('aws-sdk');
exports.handler = function(event, context, callback) {


	console.log(event);
	sendSuccessResponse(callback, event);
}

function sendSuccessResponse(callback, data) {
	sendResponse(callback, data, 200);
};

function sendFailureResponse(callback, data) {
	sendResponse(callback, {}, 500);
};

function sendResponse(callback, data, statusCode) {
	callback(null, {
        "isBase64Encoded": 1,
        "statusCode": statusCode,
        "headers": {
			'Access-Control-Allow-Origin': '*'
		},
        "body": JSON.stringify(data)
    });
};





