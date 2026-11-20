// HTTP fixture for screens that open the category picker at startup.
export const categoryResponse = () => ({ ok: true, status: 200, json: async () => ({ data: [{ id: 'POTHOLE', name: 'Buraco na via' }] }) }) as Response;
