const sanitizeFilename = (name: string): string => {
    return name.replace(/[\\/:\*\?"<>\|]/g, '');
};