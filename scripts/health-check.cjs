/* global pm */
pm.test('API pronta e resposta coerente', function () {
    pm.response.to.have.status(200);
    pm.expect(pm.response.json()).to.deep.equal({ data: { status: 'ready' } });
});
