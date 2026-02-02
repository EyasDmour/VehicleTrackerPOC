# Production Dockerfile - builds a self-contained image
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY *.csproj ./
RUN dotnet restore
COPY . ./

# Download fonts during build (fallback logic in app handles missing files)
RUN mkdir -p wwwroot/fonts
RUN curl -fsSL -o wwwroot/fonts/material-symbols-outlined.woff2 "https://fonts.gstatic.com/s/materialsymbolsoutlined/v311/kJEhBvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oFsI.woff2" || echo "Failed to download Material Symbols"
RUN curl -fsSL -o wwwroot/fonts/arimo-regular.ttf "https://fonts.gstatic.com/s/arimo/v35/P5sfzZCDf9_T_3cV7NCUECyoxNk37cxsBw.ttf" || echo "Failed to download Arimo Regular"
RUN curl -fsSL -o wwwroot/fonts/arimo-medium.ttf "https://fonts.gstatic.com/s/arimo/v35/P5sfzZCDf9_T_3cV7NCUECyoxNk338xsBw.ttf" || echo "Failed to download Arimo Medium"
RUN curl -fsSL -o wwwroot/fonts/arimo-semibold.ttf "https://fonts.gstatic.com/s/arimo/v35/P5sfzZCDf9_T_3cV7NCUECyoxNk3M8tsBw.ttf" || echo "Failed to download Arimo SemiBold"
RUN curl -fsSL -o wwwroot/fonts/arimo-bold.ttf "https://fonts.gstatic.com/s/arimo/v35/P5sfzZCDf9_T_3cV7NCUECyoxNk3CstsBw.ttf" || echo "Failed to download Arimo Bold"

RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 5001
ENV ASPNETCORE_URLS=http://+:5001
ENTRYPOINT ["dotnet", "VehicleTracker.Web.dll"]
