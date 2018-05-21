let AWS = require('aws-sdk');
let axios = require('axios');
let ses = new AWS.SES();

const PAYPAL_API_BASE_URL = 'https://api.sandbox.paypal.com';
const CLIENT_KEY = process.env['PP_CLIENT_KEY'];
const CLIENT_SECRET = process.env['PP_CLIENT_SECRET'];
const PAY_AMOUNT = '1';

const NOTIFICATION_SENDING_EMAIL = 'udith@adroitlogic.com';
const NOTIFICATION_RECEIVING_EMAIL = 'udith+paypal@adroitlogic.com';

const ERROR_CODES = {
	FAILED_PAYMENT_CREATION: 1,
	FAILED_PAYMENT_EXECUTION: 2,
	FAILED_PAYMENT_APPROVAL: 3,
	FAILED_ACCOUNT_UPGRADE: 4
};

exports.handler = function (event, context, callback) {

	let resourcePath = event.resource;
	let data = JSON.parse(event.body);

	switch (resourcePath) {
		case '/createPayment':
			createPayment(data, callback);
			break;
		case '/executePayment':
			executePayment(data, callback);
			break;
		default:
			sendFailureResponse(callback);
	}
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

	getAccessToken()
		.then(accessToken => {
			axios.post(`${PAYPAL_API_BASE_URL}/v1/payments/payment`,
				{
					"intent": "sale",
					"payer": {
						"payment_method": "paypal"
					},
					"transactions": [
						{
							"amount": {
								"total": "1",
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
						console.log('Successfully created payment', data);
						sendSuccessResponse(callback, {
							paymentId: data['id']
						});
					} else {
						console.log('Payment ID is not available');
						sendFailureResponse(callback, ERROR_CODES.FAILED_PAYMENT_CREATION);
					}
				})
				.catch(err => {
					console.log('Failed to create payment', err);
					sendFailureResponse(callback, ERROR_CODES.FAILED_PAYMENT_CREATION);
				});
		})
		.catch((err) => {
			console.log('Failed to get access token', err);
			sendNotificationEmail('Sigma - Payment Creation Failed', `Payment creation failed for ${username} due to ${err.message}`);
			sendFailureResponse(callback, ERROR_CODES.FAILED_PAYMENT_CREATION);
		});
}

function executePayment(data, callback) {

	let paymentId = data['paymentId'];
	let payertId = data['payerId'];
	let username = data['username']

	console.log('Executing payment', paymentId, payertId);

	getAccessToken()
		.then(accessToken => {
			console.log(accessToken);
			axios.post(`${PAYPAL_API_BASE_URL}/v1/payments/payment/${paymentId}/execute`,
				{
					'payer_id': payertId
				},
				{
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${accessToken}`
					}
				})
				.then(payPalResponse => {
					let data = payPalResponse.data;
					if (data['state'] === "approved") {
						console.log('Successfully executed payment', data);
						sendNotificationEmail('Sigma - Payment Received', `Successfully received payment from ${username}`);

						sendSuccessResponse(callback, {});
					} else {
						console.log('Payment execution failed', data);
						sendNotificationEmail('Sigma - Payment Failed', `Payment not approved from ${username}`);
						sendFailureResponse(callback, ERROR_CODES.FAILED_PAYMENT_APPROVAL);
					}
				})
				.catch(err => {
					console.log('Failed to execute payment', paymentId, payertId, err);
					sendNotificationEmail('Sigma - Payment Failed', `Payment failed from ${username} due to ${err.message}`);
					sendFailureResponse(callback, ERROR_CODES.FAILED_PAYMENT_EXECUTION);
				});
		})
		.catch((err) => {
			console.log('Failed to get access token', err);
			sendNotificationEmail('Sigma - Payment Failed', `Payment failed from ${username} due to ${err.message}`);
			sendFailureResponse(callback, ERROR_CODES.FAILED_PAYMENT_EXECUTION);
		});
}

function sendSuccessResponse(callback, data) {
	sendResponse(callback, data, 200);
};

function sendFailureResponse(callback, errCode) {
	sendResponse(callback, {error: errCode}, 500);
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

function sendNotificationEmail(emailSubject, emailBodyText) {
	let params = {
		Destination: {
			ToAddresses: [NOTIFICATION_RECEIVING_EMAIL]
		},
		Message: {
			Body: {
				Text: {
					Data: emailBodyText,
					Charset: 'UTF-8'
				}
			},
			Subject: {
				Data: emailSubject,
				Charset: 'UTF-8'
			}
		},
		Source: NOTIFICATION_SENDING_EMAIL
	};
	ses.sendEmail(params).promise()
	.then(data => {
		console.log('Notification email sent', emailSubject);
	})
	.catch(err => {
		console.log("Failed to send notification email", err);
	});
}

function updateUser(username) {

};
