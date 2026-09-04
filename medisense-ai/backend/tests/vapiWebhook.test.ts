jest.mock('../src/config/env', () => ({
    env: { VAPI_WEBHOOK_SECRET: 'test-webhook-secret-value' },
}));

import { verifyVapiWebhook } from '../src/middleware/vapiWebhook.middleware';
import { AppError } from '../src/utils/apiResponse';

function mockReqRes(secretHeader?: string) {
    const req: any = { header: (name: string) => (name === 'x-vapi-secret' ? secretHeader : undefined) };
    const res: any = {};
    const next = jest.fn();
    return { req, res, next };
}

describe('verifyVapiWebhook', () => {
    it('rejects a request with no secret header', () => {
        const { req, res, next } = mockReqRes(undefined);
        verifyVapiWebhook(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);
    });

    it('rejects a request with the wrong secret', () => {
        const { req, res, next } = mockReqRes('wrong-secret');
        verifyVapiWebhook(req, res, next);
        expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401);
    });

    it('accepts a request with the correct secret', () => {
        const { req, res, next } = mockReqRes('test-webhook-secret-value');
        verifyVapiWebhook(req, res, next);
        expect(next).toHaveBeenCalledWith(); // no error = pass-through
    });
});
