# vendas-service/Dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache git

# Copiar go.mod e go.sum
COPY go.mod go.sum ./

# Download dependências
RUN go mod download

# Copiar código fonte
COPY . .

# Build da aplicação
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Imagem final
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copiar binário
COPY --from=builder /app/main .

# Expor porta
EXPOSE 8080

# Comando para iniciar
CMD ["./main"]