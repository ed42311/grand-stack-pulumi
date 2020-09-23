// import * as pulumi from '@pulumi/pulumi'
import * as awsx from '@pulumi/awsx'
import * as aws from '@pulumi/aws'
import { ApolloServer, gql } from 'apollo-server-lambda'
// apollo lambda server
// graphql

const counterTable = new aws.dynamodb.Table('counterTable', {
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
// $ curl -i -H 'Content-Type: application/json' -d '{"query": "query {hello}"}'
// $ curl -i -H 'Content-Type: application/json' -H "Authorization: bearer myGithubAccessToken" -X POST -d '{"query": "query {repository(owner: \"wso2\", name: \"product-is\") {description}}"}' https://api.github.com/graphql

// https://github.com/fanout/apollo-serverless-demo
// https://raw.githubusercontent.com/serverless/serverless-graphql/master/app-backend/rest-api/resolvers.js
// Construct a schema, using GraphQL schema language
const typeDefs = gql`
  type Query {
    hello: String
  }
`

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    hello: () => 'Hello world!',
  },
}
// https://kffo35vvi8.execute-api.us-west-2.amazonaws.com/stage/
// {
//   "data": {
//     "hello" : {
//     }
//   }
// }

const server = new ApolloServer({ typeDefs, resolvers })
// const httpLambdaFunction = new aws.lambda.CallbackFunction(

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
        const route = event.pathParameters!['route']
        console.log(`Getting count for '${route}'`)

        const client = new aws.sdk.DynamoDB.DocumentClient()

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
      },
    },
    {
      path: '/graphql',
      method: 'GET',
      eventHandler: async (event) => {
        if (event.body) {
          const body = JSON.parse(event.body)
          console.log(body.query)
        }

        const graphQLHandler = server.createHandler()
        // console.log(graphQLHandler)

        return {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ test: 'test' }),
        }
      },
    },
  ],
})

// Export the public URL for the HTTP service
exports.endpoint = endpoint.url
