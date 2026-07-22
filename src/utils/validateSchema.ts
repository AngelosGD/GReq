export interface ValidationError {
  path: string
  message: string
}

export function validateAgainstSchema(data: unknown, schema: any): ValidationError[] {
  const errors: ValidationError[] = []
  validate(data, schema, [], errors)
  return errors
}

function validate(data: unknown, schema: any, path: string[], errors: ValidationError[]): void {
  if (!schema || typeof schema !== 'object') return

  if (schema.type === 'null') {
    if (data !== null) errors.push({ path: path.join('.'), message: 'Expected null' })
    return
  }

  if (schema.enum) {
    if (!schema.enum.includes(data)) errors.push({ path: path.join('.'), message: `Expected one of: ${schema.enum.join(', ')}` })
    return
  }

  if (schema.type === 'object' || schema.properties) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      errors.push({ path: path.join('.'), message: 'Expected object' })
      return
    }
    const obj = data as Record<string, unknown>

    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in obj)) errors.push({ path: [...path, key].join('.'), message: 'Required field missing' })
      }
    }

    if (schema.properties) {
      for (const [key, val] of Object.entries(schema.properties)) {
        if (key in obj) validate(obj[key], val, [...path, key], errors)
      }
    }

    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties))
      for (const key of Object.keys(obj)) {
        if (!allowed.has(key)) errors.push({ path: [...path, key].join('.'), message: 'Unexpected field' })
      }
    }
    return
  }

  if (schema.type === 'array') {
    if (!Array.isArray(data)) {
      errors.push({ path: path.join('.'), message: 'Expected array' })
      return
    }
    if (schema.items) {
      for (let i = 0; i < data.length; i++) validate(data[i], schema.items, [...path, String(i)], errors)
    }
    return
  }

  if (schema.type) {
    const valid = typeCheck(data, schema.type)
    if (!valid) errors.push({ path: path.join('.'), message: `Expected ${schema.type}, got ${typeof data}` })
  }

  if (schema.minimum !== undefined && typeof data === 'number' && data < schema.minimum) {
    errors.push({ path: path.join('.'), message: `Minimum ${schema.minimum}` })
  }
  if (schema.maximum !== undefined && typeof data === 'number' && data > schema.maximum) {
    errors.push({ path: path.join('.'), message: `Maximum ${schema.maximum}` })
  }
  if (schema.minLength !== undefined && typeof data === 'string' && data.length < schema.minLength) {
    errors.push({ path: path.join('.'), message: `Minimum length ${schema.minLength}` })
  }
  if (schema.maxLength !== undefined && typeof data === 'string' && data.length > schema.maxLength) {
    errors.push({ path: path.join('.'), message: `Maximum length ${schema.maxLength}` })
  }
  if (schema.pattern && typeof data === 'string' && !new RegExp(schema.pattern).test(data)) {
    errors.push({ path: path.join('.'), message: `Does not match pattern ${schema.pattern}` })
  }
  if (schema.minItems !== undefined && Array.isArray(data) && data.length < schema.minItems) {
    errors.push({ path: path.join('.'), message: `Minimum items ${schema.minItems}` })
  }
  if (schema.maxItems !== undefined && Array.isArray(data) && data.length > schema.maxItems) {
    errors.push({ path: path.join('.'), message: `Maximum items ${schema.maxItems}` })
  }
}

function typeCheck(data: unknown, type: string): boolean {
  switch (type) {
    case 'string': return typeof data === 'string'
    case 'integer': return Number.isInteger(data)
    case 'number': return typeof data === 'number'
    case 'boolean': return typeof data === 'boolean'
    case 'array': return Array.isArray(data)
    case 'object': return typeof data === 'object' && data !== null && !Array.isArray(data)
    case 'null': return data === null
    default: return true
  }
}
