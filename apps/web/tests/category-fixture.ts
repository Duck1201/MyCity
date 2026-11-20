export function categoriesResponse() {
    return Response.json({
        data: [
            { id: 'POTHOLE', name: 'Buraco na via' },
            { id: 'WASTE', name: 'Lixo não coletado' },
            { id: 'LIGHTING', name: 'Iluminação pública' },
            { id: 'LEAK', name: 'Vazamento na via' },
        ],
    });
}
