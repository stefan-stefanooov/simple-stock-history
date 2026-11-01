import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { AppConfig } from '../config/app-config.interface';
import { APP_CONFIG } from '../config/config.module';
import { GLOBAL_PREFIX } from '../global-prefix';
import { ProblemDetailsDto } from '../dtos';
import {
  PROBLEM_CONTENT,
  problemResponse,
} from './api-problem-response.decorator';

/** Swagger UI. */
export const SWAGGER_UI_PATH = `${GLOBAL_PREFIX}/docs`;

/** The OpenAPI document Swagger UI shows, as JSON. */
export const OPENAPI_DOCUMENT_PATH = `${SWAGGER_UI_PATH}/openapi.json`;

/**
 * Generates the OpenAPI document from the controllers and serves it with
 * Swagger UI, unless `SWAGGER_ENABLED=false`. Request parameters and response
 * bodies are described by the same zod schemas (`dtos.ts`) that validate
 * them, so the document cannot drift from what the API accepts.
 *
 * Must run before `app.init()`, so the routes are in place before Nest's 404
 * handler.
 */
export function setupSwagger(app: NestExpressApplication): void {
  const config = app.get<AppConfig>(APP_CONFIG);
  if (!config.swaggerEnabled) return;

  SwaggerModule.setup(SWAGGER_UI_PATH, app, createOpenApiDocument(app), {
    jsonDocumentUrl: OPENAPI_DOCUMENT_PATH,
    raw: ['json'],
    customSiteTitle: 'Simple Stock History API',
  });
}

/** The OpenAPI 3.1 document of every route except the Kubernetes probes. */
export function createOpenApiDocument(
  app: NestExpressApplication,
): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setOpenAPIVersion('3.1.0')
    .setTitle('Simple Stock History API')
    .setDescription(
      'Finds the Best Trade for the Share ACME within a Time Slice of its ' +
        'Price History. Times are Unix epoch seconds (UTC), prices are in ' +
        'cents. Every error is answered with an RFC 9457 ' +
        '`application/problem+json` body.',
    )
    .setVersion('1')
    .addGlobalResponse(
      problemResponse(
        500,
        'The API failed unexpectedly; the error has been logged.',
      ),
    )
    .build();

  const document = SwaggerModule.createDocument(app, builder, {
    extraModels: [ProblemDetailsDto],
  });
  documentInvalidRequests(document);
  // Turns the JSON Schemas nestjs-zod generated from the zod schemas into
  // valid OpenAPI 3.1 schemas.
  return cleanupOpenApiDoc(document);
}

/**
 * The global ZodValidationPipe checks every parameter and body against its
 * schema, so any operation that takes input can answer 400. Adds that
 * response wherever a route has not documented its own 400.
 */
function documentInvalidRequests(document: OpenAPIObject): void {
  for (const pathItem of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      const takesInput =
        (operation.parameters?.length ?? 0) > 0 ||
        operation.requestBody !== undefined;
      if (!takesInput || operation.responses['400']) continue;
      operation.responses['400'] = {
        description:
          'The request does not match its schema; `issues` lists each problem.',
        content: PROBLEM_CONTENT,
      };
    }
  }
}

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;
