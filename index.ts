// import * as pulumi from '@pulumi/pulumi'
import * as awsx from '@pulumi/awsx'

// apollo lambda server
// graphql

// Create a public HTTP endpoint (using AWS APIGateway)
const endpoint = new awsx.apigateway.API('hello', {
  routes: [
    // Serve static files from the `www` folder (using AWS S3)
    {
      path: '/',
      localPath: 'www',
    },
    {
      path: '/source',
      method: 'GET',
      eventHandler: (req, ctx, cb) => {
        cb(undefined, {
          statusCode: 200,
          body: Buffer.from(JSON.stringify({ name: 'AWS' }), 'utf8').toString(
            'base64'
          ),
          isBase64Encoded: true,
          headers: { 'content-type': 'application/json' },
        })
      },
    },
    {
      path: '/flourse',
      method: 'GET',
      eventHandler: (req, ctx, cb) => {
        cb(undefined, {
          statusCode: 200,
          body: Buffer.from(
            JSON.stringify({ nurm: 'ALLWESS' }),
            'utf8'
          ).toString('base64'),
          isBase64Encoded: true,
          headers: { 'content-type': 'application/json' },
        })
      },
    },
  ],
})

// Export the public URL for the HTTP service
exports.url = endpoint.url
