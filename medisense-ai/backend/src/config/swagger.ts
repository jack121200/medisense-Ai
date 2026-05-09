import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MediSense AI API',
            version: '1.0.0',
            description: 'Intelligent Patient Risk & Care Intelligence Platform API',
            contact: { name: 'MediSense AI Team', email: 'api@medisense.ai' },
        },
        servers: [
            { url: 'http://localhost:5000', description: 'Development server' },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: ['./src/modules/**/*.router.ts', './src/modules/**/*.controller.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
