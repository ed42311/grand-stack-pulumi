// import * as pulumi from '@pulumi/pulumi'
import * as awsx from '@pulumi/awsx'
import { dynamodb, sdk, lambda } from '@pulumi/aws'
import { ApolloServer, gql } from 'apollo-server-lambda'
// import { makeAugmentedSchema } from 'neo4j-graphql-js'
import {
  APIGatewayProxyEvent,
  Callback,
  APIGatewayProxyResult,
} from 'aws-lambda'

const AwsLambdaContextForPulumiContext = (
  pulumiContext: lambda.Context
): AWSLambda.Context => {
  const lambdaContext: AWSLambda.Context = {
    done() {
      throw new Error('done is just a placeholder ')
    },
    fail() {
      throw new Error('fail is just a placeholder ')
    },
    succeed() {
      throw new Error('succeed is just a placeholder ')
    },
    ...pulumiContext,
    getRemainingTimeInMillis: () =>
      parseInt(pulumiContext.getRemainingTimeInMillis(), 10),
    memoryLimitInMB: pulumiContext.memoryLimitInMB,
  }
  return lambdaContext
}

const counterTable = new dynamodb.Table('counterTable', {
  attributes: [
    {
      name: 'id',
      type: 'S',
    },
  ],
  hashKey: 'id',
  readCapacity: 5,
  writeCapacity: 5,
})
// $ curl -d '{"query": "query {hello}"}' $(pulumi stack output endpoint)/graphql

// https://github.com/fanout/apollo-serverless-demo
// https://raw.githubusercontent.com/serverless/serverless-graphql/master/app-backend/rest-api/resolvers.js

// const createHandler = async () => {
//   return server.createHandler()
// }

// const graphql = (
//   event: APIGatewayProxyEvent,
//   context: PulumiContext,
//   callback: Callback<APIGatewayProxyResult>
// ) => {
//   createHandler().then((handler) => handler(event, context, callback))
// }

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
      path: '/count/{route+}',
      method: 'GET',
      eventHandler: async (event) => {
        if (event.pathParameters) {
          const route = event.pathParameters['route']
          console.log(`Getting count for '${route}'`)

          const client = new sdk.DynamoDB.DocumentClient()

          // get previous value and increment
          // reference outer `counterTable` object
          const tableData = await client
            .get({
              TableName: counterTable.name.get(),
              Key: { id: route },
              ConsistentRead: true,
            })
            .promise()

          const value = tableData.Item
          let count = (value && value.count) || 0

          await client
            .put({
              TableName: counterTable.name.get(),
              Item: { id: route, count: ++count },
            })
            .promise()

          console.log(`Got count ${count} for '${route}'`)
          return {
            statusCode: 200,
            body: JSON.stringify({ route, count }),
          }
        }
        return {
          statusCode: 200,
          body: JSON.stringify({ err: 'no route' }),
        }
      },
    },
    {
      path: '/graphql',
      method: 'POST',
      eventHandler: (
        event: APIGatewayProxyEvent,
        context: lambda.Context,
        callback: Callback<APIGatewayProxyResult>
      ) => {
        const awsContext = AwsLambdaContextForPulumiContext(context)
        // load from a schema file
        const typeDefs = gql`
          type Query {
            hello: String
          }
        `
        const resolvers = {
          Query: {
            hello: () => 'Hello world!',
          },
        }
        const server = new ApolloServer({
          typeDefs,
          resolvers,
          playground: true,
        })
        server.createHandler()(event, awsContext, callback)
      },
    },
  ],
})

// Export the public URL for the HTTP service
exports.endpoint = endpoint.url
