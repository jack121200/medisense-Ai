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
            {
                // Render injects RENDER_EXTERNAL_URL into every web service, so the
                // docs' "Try it out" targets the live URL there with no extra config.
                url: process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 5000}`,
                description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
            },
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
