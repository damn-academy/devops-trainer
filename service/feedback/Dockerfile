FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /feedback .
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /feedback /feedback
ENV ADDR=:6101 DATABASE_URL=/data/feedback.sqlite
EXPOSE 6101
ENTRYPOINT ["/feedback"]
