// import * as pulumi from '@pulumi/pulumi'

import * as awsx from '@pulumi/awsx'
import { lambda } from '@pulumi/aws'
import {
  APIGatewayProxyEvent,
  Callback,
  APIGatewayProxyResult,
} from 'aws-lambda'

import { ApolloServer, gql } from 'apollo-server-lambda'
// import { ApolloServer } from 'apollo-server-lambda'

import neo4j from 'neo4j-driver'

// eslint-disable-next-line
// const neo4jGraphqlJs = require('neo4j-graphql-js')
// const { makeAugmentedSchema } = neo4jGraphqlJs

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
        // $ curl -d '{"query": "query {hello}"}' $(pulumi stack output endpoint)/
        // $ curl -d '{"query": "Movie(title: \"Cloud Atlas\") {title}"}' https://qtta34wlsg.execute-api.us-west-2.amazonaws.com/stage/
        const typeDefs = gql`
          type Query {
            numberSix: Int!
            numberTwo: Int!
          }
        `
        // const schema = makeAugmentedSchema({ typeDefs })
        const driver = neo4j.driver(
          'bolt://52.86.81.2:33027',
          neo4j.auth.basic('neo4j', 'crews-bridges-holddowns')
        )

        const resolvers = {
          Query: {
            numberSix(object: any, params: any, context: any, info: any) {
              console.log(object)
              console.log(params)
              console.log(context)
              console.log(info)
              return 6
            },
            numberTwo(_object: any, _params: any, context: any, _info: any) {
              console.log(context.driver.session({}))
              return 2
            },
          },
        }
        const server = new ApolloServer({
          typeDefs,
          resolvers,
          // introspection: true,
          playground: {
            endpoint: '/dev/graphql',
          },
          context: (what: any) => {
            console.log(what)
            return {
              driver,
            }
          },
        })

        if (event.httpMethod === 'GET') {
          console.log('GET PLAYGROUND')
          server.createHandler()(
            { ...event, path: event.requestContext.path || event.path },
            awsContext,
            callback
          )
        } else {
          console.log('NOT GET')
          server.createHandler()(event, awsContext, callback)
        }
      },
    },
  ],
})

// Export the public URL for the HTTP service
exports.endpoint = endpoint.url
