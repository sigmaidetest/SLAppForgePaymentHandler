let AWS = require('aws-sdk');
let axios = require('axios');

const PAYPAL_API_BASE_URL = 'https://api.sandbox.paypal.com';
const CLIENT_KEY = process.env['PP_CLIENT_KEY'];
const CLIENT_SECRET = process.env['PP_CLIENT_SECRET'];
const PAY_AMOUNT = '1';

exports.handler = function (event, context, callback) {

	let resourcePath = event.resource;
	let data = event.body;

	switch (resourcePath) {
		case '/createPayment':
			createPayment(data, callback);
			break;
		case '/executePayment':
			break;
		default:
			sendFailureResponse(callback);
	}

	console.log(event);
	sendSuccessResponse(callback, event);
}

function getAccessToken() {
	return new Promise((resolve, reject) => {
		axios.post(`${PAYPAL_API_BASE_URL}/v1/oauth2/token?grant_type=client_credentials`, null, {
			headers: {
				'Accept': 'application/json',
				'Accept-Language': 'en_US',
			},
			auth: {
				username: CLIENT_KEY,
				password: CLIENT_SECRET
			}
		}).then(response => {
			let data = response.data;
			if (data && data['access_token']) {
				resolve(data['access_token']);
			} else {
				reject('token not found');
			}
		}).catch(err => {
			reject(err);
		});
	});
};

function createPayment(data, callback) {

	let callbackUrl = data['callbackUrl'];

	getAuthToken()
		.then(accessToken => {
			console.log(accessToken);
			axios.post(`${PAYPAL_API_BASE_URL}/v1/payments/payment`,
				{
					"intent": "sale",
					"payer": {
						"payment_method": "paypal"
					},
					"transactions": [
						{
							"amount": {
								"total": PAY_AMOUNT,
								"currency": "USD",
							},
							"description": "SLAppForge Sigma 1-year premium subscription",
						}
					],
					// "note_to_payer": "Contact us for any questions on your order.",
					"redirect_urls": {
						"return_url": callbackUrl,
						"cancel_url": callbackUrl
					}
				},
				{
					headers: {
						'Authorization': `Bearer ${accessToken}`
					}
				})
				.then(payPalResponse => {
					let data = payPalResponse.data;
					if (data && data['id']) {
						console.log('Payment data', data);
						sendSuccessResponse(callback, {
							paymentId: data['id']
						});
					} else {
						console.log('Payment ID is not available');
						sendFailureResponse(callback);
					}
				})
				.catch(err => {
					console.log('Failed to create payment', err);
					sendFailureResponse(callback);
				});
		})
		.catch((err) => {
			console.log('Failed to get access token', err);
			sendFailureResponse(callback);
		});
}

function sendSuccessResponse(callback, data) {
	sendResponse(callback, data, 200);
};

function sendFailureResponse(callback) {
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





