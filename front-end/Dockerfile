# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package.json e package-lock.json (se existir)
COPY package.json ./



# Instalar dependências (inclui devDependencies, necessário para react-scripts)
RUN npm install

# Copiar código fonte
COPY . .

# Build da aplicação
RUN npm run build

# Production stage
FROM nginx:alpine

# Copiar arquivos build
COPY --from=builder /app/build /usr/share/nginx/html

# Copiar configuração nginx (se quiser usar)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
