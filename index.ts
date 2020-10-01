// import * as pulumi from '@pulumi/pulumi'
import {
  APIGatewayProxyEvent,
  Callback,
  APIGatewayProxyResult,
} from 'aws-lambda'
import * as awsx from '@pulumi/awsx'
import { lambda } from '@pulumi/aws'
import { ApolloServer, gql } from 'apollo-server-lambda'
// import neo4j from 'neo4j-driver'

// // eslint-disable-next-line
// const neo4jGraphqlJs = require('neo4j-graphql-js')

// const { makeAugmentedSchema } = neo4jGraphqlJs

// We need some types up in here
// https://github.com/neo4j-graphql/neo4j-graphql-js/issues/275

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

// This is our whole stack, kinda cool
// Create a public HTTP endpoint (using AWS APIGateway)
const endpoint = new awsx.apigateway.API('hello', {
  routes: [
    {
      path: '/',
      method: 'ANY',
      eventHandler: (
        event: APIGatewayProxyEvent,
        context: lambda.Context,
        callback: Callback<APIGatewayProxyResult>
      ) => {
        // This is our backend, it holds our schema
        // Our Apollo instance and our connection credentials to our sandbox
        const awsContext = AwsLambdaContextForPulumiContext(context)
        // $ curl -d '{"query": "query {hello}"}' $(pulumi stack output endpoint)/
        // $ curl -d '{"query": "{query{Movie(title: \"Cloud Atlas\") {title}}}"}' https://qtta34wlsg.execute-api.us-west-2.amazonaws.com/stage/graphql

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
          introspection: true,
          playground: {
            endpoint: '/dev/graphql',
          },
        })
        if (event.httpMethod === 'GET') {
          server.createHandler()(
            { ...event, path: event.requestContext.path || event.path },
            awsContext,
            callback
          )
        } else {
          server.createHandler()(event, awsContext, callback)
        }
        server.createHandler()(event, awsContext, callback)
      },
    },
  ],
})

// Export the public URL for the HTTP service
exports.endpoint = endpoint.url
