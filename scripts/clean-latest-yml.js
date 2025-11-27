#!/usr/bin/env node
/**
 * Script untuk membersihkan latest.yml agar hanya berisi file untuk arsitektur tertentu
 * Usage: node clean-latest-yml.js <input-file> <output-file> <arch>
 * Example: node clean-latest-yml.js out/latest.yml out/latest.yml x64
 */

const fs = require('fs');
const path = require('path');

function parseYaml(content) {
    // Simple YAML parser untuk format latest.yml electron-builder
    const result = {};
    const lines = content.split('\n');
    let currentKey = null;
    let inFilesArray = false;
    let currentFile = null;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines
        if (!trimmed) continue;
        
        // Check if we're entering files array
        if (trimmed === 'files:') {
            result.files = [];
            inFilesArray = true;
            continue;
        }
        
        if (inFilesArray) {
            // New file entry
            if (trimmed.startsWith('- url:')) {
                if (currentFile) {
                    result.files.push(currentFile);
                }
                currentFile = {
                    url: trimmed.replace('- url:', '').trim()
                };
            } else if (trimmed.startsWith('sha512:') && currentFile) {
                currentFile.sha512 = trimmed.replace('sha512:', '').trim();
            } else if (trimmed.startsWith('size:') && currentFile) {
                currentFile.size = parseInt(trimmed.replace('size:', '').trim(), 10);
            } else if (!line.startsWith(' ') && !line.startsWith('\t') && !trimmed.startsWith('-')) {
                // Exiting files array
                if (currentFile) {
                    result.files.push(currentFile);
                    currentFile = null;
                }
                inFilesArray = false;
            }
        }
        
        if (!inFilesArray) {
            // Parse top-level key-value pairs
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex > 0 && !trimmed.startsWith('-')) {
                const key = trimmed.substring(0, colonIndex);
                let value = trimmed.substring(colonIndex + 1).trim();
                
                // Remove quotes if present
                if ((value.startsWith("'") && value.endsWith("'")) ||
                    (value.startsWith('"') && value.endsWith('"'))) {
                    value = value.slice(1, -1);
                }
                
                result[key] = value;
            }
        }
    }
    
    // Push last file if any
    if (currentFile && result.files) {
        result.files.push(currentFile);
    }
    
    return result;
}

function toYaml(data) {
    let result = '';
    
    // Write version first
    if (data.version) {
        result += `version: ${data.version}\n`;
    }
    
    // Write files array
    if (data.files && data.files.length > 0) {
        result += 'files:\n';
        for (const file of data.files) {
            result += `  - url: ${file.url}\n`;
            if (file.sha512) {
                result += `    sha512: ${file.sha512}\n`;
            }
            if (file.size) {
                result += `    size: ${file.size}\n`;
            }
        }
    }
    
    // Write path
    if (data.path) {
        result += `path: ${data.path}\n`;
    }
    
    // Write sha512
    if (data.sha512) {
        result += `sha512: ${data.sha512}\n`;
    }
    
    // Write releaseDate
    if (data.releaseDate) {
        result += `releaseDate: '${data.releaseDate}'\n`;
    }
    
    return result;
}

function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log('Usage: node clean-latest-yml.js <input-file> <output-file> <arch>');
        console.log('Example: node clean-latest-yml.js out/latest.yml out/latest.yml x64');
        process.exit(1);
    }
    
    const [inputFile, outputFile, arch] = args;
    
    if (!fs.existsSync(inputFile)) {
        console.error(`Error: Input file not found: ${inputFile}`);
        process.exit(1);
    }
    
    console.log(`Cleaning ${inputFile} for architecture: ${arch}`);
    
    const content = fs.readFileSync(inputFile, 'utf8');
    const data = parseYaml(content);
    
    console.log(`Original files count: ${data.files ? data.files.length : 0}`);
    
    // Filter files by architecture
    if (data.files && data.files.length > 0) {
        data.files = data.files.filter(f => {
            if (!f.url) return false;
            return f.url.includes(arch);
        });
        
        console.log(`Filtered files count: ${data.files.length}`);
        
        // Update path and sha512 from the first file
        if (data.files.length > 0) {
            data.path = data.files[0].url;
            data.sha512 = data.files[0].sha512;
            console.log(`Updated path to: ${data.path}`);
        }
    }
    
    // Write output
    const output = toYaml(data);
    fs.writeFileSync(outputFile, output);
    
    console.log(`✅ Successfully cleaned ${outputFile}`);
    console.log('--- Content ---');
    console.log(output);
}

main();

