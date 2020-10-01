// import * as pulumi from '@pulumi/pulumi'

import * as awsx from '@pulumi/awsx'
import { lambda } from '@pulumi/aws'
import {
  APIGatewayProxyEvent,
  Callback,
  APIGatewayProxyResult,
} from 'aws-lambda'

import { ApolloServer } from 'apollo-server-lambda'

import neo4j from 'neo4j-driver'

// eslint-disable-next-line
const neo4jGraphqlJs = require('neo4j-graphql-js')
const { makeAugmentedSchema } = neo4jGraphqlJs

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
        const awsContext = AwsLambdaContextForPulumiContext(context)
        const typeDefs = `
type Person {
  name: String
}
        `
        const schema = makeAugmentedSchema({ typeDefs })
        const driver = neo4j.driver(
          'bolt://52.86.81.2:33027',
          neo4j.auth.basic('neo4j', 'crews-bridges-holddowns')
        )
        const server = new ApolloServer({
          schema,
          playground: {
            endpoint: '/dev/graphql',
          },
          context: { driver },
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
      },
    },
  ],
})

// Export the public URL for the HTTP service
exports.endpoint = endpoint.url
