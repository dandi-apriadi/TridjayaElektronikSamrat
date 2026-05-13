const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const filePath = 'c:\\Users\\acer\\Desktop\\Project\\RUST\\Tridjaya Manado\\docs\\data\\Format Template.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log('---START---');
    console.log(JSON.stringify({
        headers: data[0],
        sample: data[1]
    }));
    console.log('---END---');
} catch (error) {
    console.error('Error:', error.message);
}
