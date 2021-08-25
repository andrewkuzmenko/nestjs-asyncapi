import { SwaggerDocumentOptions } from '@nestjs/swagger';

import { AsyncAPIObject } from './index';
import { AsyncapiScanner } from './asyncapi.scanner';
import { INestApplication, Logger } from '@nestjs/common';
import { AsyncApiGenerator } from './services/async-api-generator';
import { ContractParser } from './services/contract-parser';
import { validatePath } from '@nestjs/swagger/dist/utils/validate-path.util';
import { AsyncApiTemplateOptions } from '@lib/interfaces/async-api-template-options.interface';

export interface AsyncApiDocumentOptions extends SwaggerDocumentOptions {}

export class AsyncApiModule {
  private static readonly logger = new Logger(AsyncApiModule.name);

  public static async setup(path: string, app: INestApplication, document: AsyncAPIObject, templateOptions?: AsyncApiTemplateOptions) {
    return this.setupExpress(path, app, document, templateOptions);
  }

  public static createDocument(
    app: INestApplication,
    config: Omit<AsyncAPIObject, 'channels'>,
    options: AsyncApiDocumentOptions = {},
  ): AsyncAPIObject {
    const asyncapiScanner = new AsyncapiScanner();
    const document = asyncapiScanner.scanApplication(app, options);
    document.components = {
      ...(config.components || {}),
      ...document.components,
    };
    return {
      asyncapi: '2.1.0',
      ...config,
      ...document,
    };
  }

  static async composeHtml(contract: AsyncAPIObject, templateOptions?: AsyncApiTemplateOptions) {
    const generator = new AsyncApiGenerator(templateOptions);
    return await generator.generate(contract).catch((e) => {
      this.logger.error(e);
      throw e;
    });
  }

  private static async setupExpress(path: string, app: INestApplication, document: AsyncAPIObject, templateOptions?: AsyncApiTemplateOptions) {
    const httpAdapter = app.getHttpAdapter();
    const finalPath = validatePath(path);

    const html = await this.composeHtml(document, templateOptions);

    const parser = new ContractParser();

    httpAdapter.get(finalPath, (req, res) => res.send(html));
    httpAdapter.get(finalPath + '-json', (req, res) => res.json(document));
    httpAdapter.get(finalPath + '-yml', (req, res) => res.json(parser.parse(document)));
  }
}
